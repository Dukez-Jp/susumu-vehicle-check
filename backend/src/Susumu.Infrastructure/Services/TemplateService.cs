using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Services;

/// <summary>
/// Checklist templates are versioned and append-only. Publishing freezes a version; changing a
/// checklist always produces a new version row, so historical inspections keep their exact wording.
/// </summary>
public sealed class TemplateService(SusumuDbContext db, IClock clock)
{
    public async Task<IReadOnlyList<ChecklistTemplateDto>> ListAsync(CurrentUser actor, CancellationToken ct)
    {
        var query = db.ChecklistTemplates.AsNoTracking().InScope(actor);

        // Drafts are editorial state; only reviewers see versions that were never published.
        if (!actor.CanReview)
        {
            query = query.Where(t => t.Published);
        }

        var templates = await query
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .OrderBy(t => t.VehicleType).ThenBy(t => t.Name).ThenBy(t => t.Version)
            .ToListAsync(ct);

        return templates.Select(t => t.ToDto()).ToList();
    }

    public async Task<ChecklistTemplateDto> GetAsync(CurrentUser actor, Guid id, CancellationToken ct)
    {
        var template = await db.ChecklistTemplates.AsNoTracking().InScope(actor)
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound($"Template {id} was not found in your scope.");

        if (!template.Published && !actor.CanReview)
        {
            throw AppException.NotFound($"Template {id} was not found in your scope.");
        }

        return template.ToDto();
    }

    public async Task<ChecklistTemplateDto> CreateVersionAsync(
        CurrentUser actor, TemplateWriteRequest request, CancellationToken ct)
    {
        RequireEditor(actor);

        var name = (request.Name ?? string.Empty).Trim();
        var vehicleType = (request.VehicleType ?? string.Empty).Trim();
        Validate(name, vehicleType, request.Sections);

        // A new version is a company-wide write: it must not interleave with a role revocation or
        // with a vehicle type being retired, and it must not race another editor on the version
        // counter. The lock is held through SaveChanges and the commit.
        await using var transaction = await OrganizationAdministrationService.BeginCompanyWriteAsync(
            db, actor.CompanyId, ct);
        await RequirePersistedEditorAsync(actor, ct);

        // Resolved inside the transaction and before the version counter is read, so a new version
        // can never be created for a type that is being retired concurrently, and so the stored
        // vehicleType is the catalog's canonical spelling. Templates already published against a
        // type that was later retired keep their exact code and stay readable and syncable.
        vehicleType = await VehicleTypeService.ResolveActiveCodeAsync(db, actor.CompanyId, vehicleType, ct);

        var currentMax = await db.ChecklistTemplates
            .Where(t => t.CompanyId == actor.CompanyId && t.VehicleType == vehicleType && t.Name == name)
            .Select(t => (int?)t.Version)
            .MaxAsync(ct) ?? 0;

        var now = clock.UtcNow;
        var template = new ChecklistTemplate
        {
            Id = Guid.NewGuid(),
            CompanyId = actor.CompanyId,
            Name = name,
            VehicleType = vehicleType,
            Version = currentMax + 1,
            Published = false,
            RequiresSignature = request.RequiresSignature,
            CreatedAt = now,
            CreatedByUserId = actor.Id,
        };

        var sectionOrder = 0;
        foreach (var sectionDto in request.Sections!)
        {
            var section = new ChecklistSection
            {
                Id = sectionDto.Id ?? Guid.NewGuid(),
                TemplateId = template.Id,
                Title = sectionDto.Title!.Trim(),
                OrderIndex = sectionOrder++,
            };

            var itemOrder = 0;
            foreach (var itemDto in sectionDto.Items!)
            {
                section.Items.Add(new ChecklistItem
                {
                    Id = itemDto.Id ?? Guid.NewGuid(),
                    SectionId = section.Id,
                    Label = itemDto.Label!.Trim(),
                    ResponseType = itemDto.ResponseType!.Value,
                    Required = itemDto.Required,
                    Unit = string.IsNullOrWhiteSpace(itemDto.Unit) ? null : itemDto.Unit.Trim(),
                    MinValue = itemDto.MinValue,
                    MaxValue = itemDto.MaxValue,
                    OrderIndex = itemOrder++,

                    // Stored verbatim, in the submitted order. Omitted stays null, which is the
                    // standard classification; an explicit list is frozen with this version.
                    AllowedStatuses = itemDto.AllowedStatuses?.ToList(),
                });
            }

            template.Sections.Add(section);
        }

        db.ChecklistTemplates.Add(template);
        db.AuditEntries.Add(Audit.Entry(now, actor.Id, actor.CompanyId, AuditActions.TemplateCreated, "checklist_template",
            template.Id, details: $"name={template.Name}; vehicleType={template.VehicleType}; version={template.Version}"));

        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Two editors racing on the same family: the unique (company, type, name, version) index wins.
            throw AppException.Conflict(
                "Another version of this template was created concurrently. Reload and try again.");
        }

        return template.ToDto();
    }

    public async Task<ChecklistTemplateDto> PublishAsync(CurrentUser actor, Guid id, CancellationToken ct)
    {
        RequireEditor(actor);

        var template = await db.ChecklistTemplates.InScope(actor)
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound($"Template {id} was not found in your scope.");

        if (template.Published)
        {
            throw AppException.Conflict("This template version is already published and cannot be modified.");
        }

        var now = clock.UtcNow;
        template.Published = true;
        template.PublishedAt = now;

        db.AuditEntries.Add(Audit.Entry(now, actor.Id, actor.CompanyId, AuditActions.TemplatePublished,
            "checklist_template", template.Id,
            details: $"name={template.Name}; vehicleType={template.VehicleType}; version={template.Version}"));

        await db.SaveChangesAsync(ct);
        return template.ToDto();
    }

    /// <summary>
    /// Toggles availability for new work. The frozen definition, its version and its publication are
    /// untouched, and inspections already pinned to the version keep syncing and reading normally.
    /// </summary>
    public async Task<ChecklistTemplateDto> SetAvailabilityAsync(
        CurrentUser actor, Guid id, bool active, CancellationToken ct)
    {
        RequireEditor(actor);

        var template = await db.ChecklistTemplates.InScope(actor)
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound($"Template {id} was not found in your scope.");

        if (template.Active != active)
        {
            var now = clock.UtcNow;
            template.Active = active;

            db.AuditEntries.Add(Audit.Entry(
                now, actor.Id, actor.CompanyId,
                active ? AuditActions.TemplateActivated : AuditActions.TemplateRetired,
                "checklist_template", template.Id,
                details: $"name={template.Name}; vehicleType={template.VehicleType}; version={template.Version}"));

            await db.SaveChangesAsync(ct);
        }

        return template.ToDto();
    }

    /// <summary>
    /// Re-reads the actor after the company lock is held. Authentication may have happened long
    /// before this request reached the front of the queue, so a token alone must not carry a
    /// mutation past a revoked role, a deactivated account, company or location.
    /// </summary>
    private async Task RequirePersistedEditorAsync(CurrentUser actor, CancellationToken ct)
    {
        var stillAnEditor = await db.Users.AsNoTracking().AnyAsync(u =>
            u.Id == actor.Id && u.CompanyId == actor.CompanyId && u.Active &&
            (u.Role == UserRole.Administrator || u.Role == UserRole.Supervisor) &&
            u.Company != null && u.Company.Active &&
            u.Location != null && u.Location.Active && u.Location.CompanyId == actor.CompanyId, ct);

        if (!stillAnEditor)
        {
            throw AppException.Forbidden(
                "An active administrator or supervisor account, company and location are required to manage checklist templates.");
        }
    }

    private static void RequireEditor(CurrentUser actor)
    {
        if (!actor.CanReview)
        {
            throw AppException.Forbidden("Only supervisors and administrators can manage checklist templates.");
        }
    }

    private static void Validate(string name, string vehicleType, IReadOnlyList<ChecklistSectionWriteDto>? sections)
    {
        var errors = new Dictionary<string, string[]>();

        if (name.Length is 0 or > 200)
        {
            errors["name"] = ["Required, at most 200 characters."];
        }

        if (vehicleType.Length is 0 or > 80)
        {
            errors["vehicleType"] = ["Required, at most 80 characters."];
        }

        if (sections is null || sections.Count == 0)
        {
            errors["sections"] = ["At least one section is required."];
            throw AppException.Validation("Invalid checklist template.", errors);
        }

        var seenIds = new HashSet<Guid>();
        for (var s = 0; s < sections.Count; s++)
        {
            var section = sections[s];
            if (string.IsNullOrWhiteSpace(section.Title) || section.Title.Trim().Length > 200)
            {
                errors[$"sections[{s}].title"] = ["Required, at most 200 characters."];
            }

            if (section.Id is not null && !seenIds.Add(section.Id.Value))
            {
                errors[$"sections[{s}].id"] = ["Duplicate identifier in payload."];
            }

            if (section.Items is null || section.Items.Count == 0)
            {
                errors[$"sections[{s}].items"] = ["At least one item is required."];
                continue;
            }

            for (var i = 0; i < section.Items.Count; i++)
            {
                var item = section.Items[i];
                var prefix = $"sections[{s}].items[{i}]";

                if (string.IsNullOrWhiteSpace(item.Label) || item.Label.Trim().Length > 300)
                {
                    errors[$"{prefix}.label"] = ["Required, at most 300 characters."];
                }

                if (item.Id is not null && !seenIds.Add(item.Id.Value))
                {
                    errors[$"{prefix}.id"] = ["Duplicate identifier in payload."];
                }

                // A missing responseType would silently become "status" and turn a measurement into
                // an unmeasured checkbox for the life of the published version.
                if (item.ResponseType is not { } responseType || !Enum.IsDefined(responseType))
                {
                    errors[$"{prefix}.responseType"] = ["Required; one of status or measurement."];
                    continue;
                }

                if (item.MinValue is not null && item.MaxValue is not null && item.MinValue > item.MaxValue)
                {
                    errors[$"{prefix}.minValue"] = ["minValue cannot be greater than maxValue."];
                }

                if (responseType == ResponseType.Status && (item.MinValue is not null || item.MaxValue is not null))
                {
                    errors[$"{prefix}.responseType"] = ["Bounds are only valid for measurement items."];
                }

                InspectionSyncService.ValidateMeasurement(item.MinValue, $"{prefix}.minValue", errors);
                InspectionSyncService.ValidateMeasurement(item.MaxValue, $"{prefix}.maxValue", errors);
                ValidateAllowedStatuses(item, $"{prefix}.allowedStatuses", errors);
            }
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation("Invalid checklist template.", errors);
        }
    }

    /// <summary>
    /// The options are a configurable subset of the standard safety classification, so they stay
    /// reportable. Options apply to measurement items too: a measurement still carries a status.
    /// An empty list is rejected rather than treated as "all", because it would leave an item that
    /// can never be answered, and "omitted" already has a defined meaning.
    /// </summary>
    private static void ValidateAllowedStatuses(
        ChecklistItemWriteDto item, string field, IDictionary<string, string[]> errors)
    {
        if (item.AllowedStatuses is not { } allowed)
        {
            return;
        }

        if (allowed.Count == 0)
        {
            errors[field] = ["Send at least one option, or omit the field to offer all standard statuses."];
            return;
        }

        if (allowed.Any(status => !Enum.IsDefined(status)))
        {
            errors[field] = ["Contains a value that is not a defined item status."];
            return;
        }

        if (allowed.Distinct().Count() != allowed.Count)
        {
            errors[field] = ["The same option cannot be listed twice."];
            return;
        }

        // Otherwise the item is mandatory and its only possible answer is "does not apply", which
        // no inspector could ever satisfy.
        if (item.Required && allowed.All(status => status == ItemStatus.NotApplicable))
        {
            errors[field] = ["A required item must offer at least one option other than NotApplicable."];
        }
    }
}
