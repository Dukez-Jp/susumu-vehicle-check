using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;

namespace Susumu.Infrastructure.Services;

public sealed class ReportingService(SusumuDbContext db)
{
    public const int RecentInspectionCount = 10;
    public const int MaxAuditRows = 200;
    public const int MaxExportRows = 20_000;

    public async Task<DashboardResponse> DashboardAsync(CurrentUser actor, CancellationToken ct)
    {
        var inspections = db.Inspections.AsNoTracking().InScope(actor);

        var vehicles = await db.Vehicles.AsNoTracking().InScope(actor).CountAsync(v => v.Active, ct);
        var total = await inspections.CountAsync(ct);
        var drafts = await inspections.CountAsync(i => i.State == InspectionState.Draft, ct);
        var finalized = await inspections.CountAsync(i => i.State == InspectionState.Finalized, ct);

        var criticalItems = await inspections
            .SelectMany(i => i.Items)
            .CountAsync(item => item.Status == ItemStatus.Critical, ct);

        // Number of *inspections* still awaiting attachment bytes, which is what the dashboard label
        // says. Counting photo rows instead would report a different number from the same word.
        var pendingPhotos = await inspections
            .CountAsync(i => i.Photos.Any(p => !p.Uploaded), ct);

        var recent = await inspections
            .Include(i => i.Items)
            .Include(i => i.Photos)
            .Include(i => i.CreatedBy)
            .OrderByDescending(i => i.ReceivedAt)
            .Take(RecentInspectionCount)
            .ToListAsync(ct);

        return new DashboardResponse(
            vehicles, total, drafts, finalized, criticalItems, pendingPhotos,
            recent.Select(i => i.ToDto()).ToList());
    }

    public async Task<IReadOnlyList<AuditEntryDto>> AuditAsync(
        CurrentUser actor, Guid? inspectionId, int? offset, int? limit, CancellationToken ct)
    {
        var (skip, take) = Paging.Validate(offset, limit, MaxAuditRows);

        if (!actor.CanReview)
        {
            throw AppException.Forbidden("Only supervisors and administrators can read the audit log.");
        }

        var query = db.AuditEntries.AsNoTracking().Where(a => a.CompanyId == actor.CompanyId);

        if (!actor.IsCompanyWide)
        {
            // A supervisor reviews their own location. Company-wide rows (other locations, account
            // administration) belong to administrators only.
            var scopedInspections = db.Inspections.InScope(actor).Select(i => (Guid?)i.Id);
            var scopedUsers = db.Users.InScope(actor).Select(u => (Guid?)u.Id);

            query = query.Where(a =>
                (a.InspectionId != null && scopedInspections.Contains(a.InspectionId)) ||
                (a.InspectionId == null && a.ActorId != null && scopedUsers.Contains(a.ActorId)));
        }

        if (inspectionId is not null)
        {
            // Confirm the inspection is inside the caller's scope before exposing its trail.
            var visible = await db.Inspections.AsNoTracking().InScope(actor)
                .AnyAsync(i => i.Id == inspectionId.Value, ct);

            if (!visible)
            {
                throw AppException.NotFound($"Inspection {inspectionId} was not found in your scope.");
            }

            query = query.Where(a => a.InspectionId == inspectionId.Value);
        }

        var rows = await query
            .OrderByDescending(a => a.At)
            .ThenByDescending(a => a.Id)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

        return rows
            .Select(a => new AuditEntryDto(a.Id, a.ActorId, a.Action, a.EntityId, a.At, a.Details))
            .ToList();
    }

    /// <summary>
    /// Item-level CSV of the inspections visible to the caller. Every cell is quoted and any cell that
    /// a spreadsheet would evaluate as a formula is prefixed with an apostrophe.
    /// </summary>
    public async Task<string> InspectionsCsvAsync(
        CurrentUser actor, Guid? vehicleId, InspectionState? state, CancellationToken ct)
    {
        var query = db.Inspections.AsNoTracking().InScope(actor);

        if (vehicleId is not null)
        {
            query = query.Where(i => i.VehicleId == vehicleId.Value);
        }

        if (state is not null)
        {
            query = query.Where(i => i.State == state.Value);
        }

        // Never truncate silently: an export that quietly stopped at the limit would read as the
        // complete record. Over the limit the caller is told to narrow the filter instead.
        var total = await query.CountAsync(ct);
        if (total > MaxExportRows)
        {
            throw AppException.Validation(
                $"This export would contain {total} inspections, above the {MaxExportRows} limit. " +
                "Narrow it with vehicleId and/or state and export again.",
                new Dictionary<string, string[]>
                {
                    ["filter"] = [$"Matched {total} inspections; the maximum per export is {MaxExportRows}."],
                });
        }

        var inspections = await query
            .Include(i => i.Items)
            .Include(i => i.Photos)
            .Include(i => i.Vehicle)
            .Include(i => i.Template)
            .Include(i => i.CreatedBy)
            .OrderByDescending(i => i.StartedAt)
            .ThenByDescending(i => i.Id)
            .ToListAsync(ct);

        var itemLabels = await LoadItemLabelsAsync(inspections, ct);

        var csv = new StringBuilder();
        csv.AppendLine(string.Join(',',
        [
            "inspectionId", "vehicleInternalNumber", "vehiclePlate", "vehicleType", "templateName",
            "templateVersion", "state", "startedAt", "finalizedAt", "receivedAt", "createdBy",
            "deviceId", "odometerKm", "photoUploadState", "itemId", "itemLabel", "itemStatus",
            "itemValue", "itemNotes", "inspectionNotes",
        ]));

        foreach (var inspection in inspections)
        {
            var photoState = Mapping.UploadState(inspection.Photos).ToString();

            if (inspection.Items.Count == 0)
            {
                csv.AppendLine(Row(inspection, photoState, itemLabels, null));
                continue;
            }

            foreach (var item in inspection.Items.OrderBy(i => i.ItemId))
            {
                csv.AppendLine(Row(inspection, photoState, itemLabels, item));
            }
        }

        return csv.ToString();
    }

    private async Task<Dictionary<Guid, string>> LoadItemLabelsAsync(
        IReadOnlyCollection<Inspection> inspections, CancellationToken ct)
    {
        var itemIds = inspections.SelectMany(i => i.Items).Select(i => i.ItemId).Distinct().ToList();
        if (itemIds.Count == 0)
        {
            return [];
        }

        return await db.ChecklistItems.AsNoTracking()
            .Where(i => itemIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, i => i.Label, ct);
    }

    private static string Row(
        Inspection inspection,
        string photoState,
        IReadOnlyDictionary<Guid, string> itemLabels,
        InspectionItemRecord? item)
    {
        string?[] cells =
        [
            inspection.Id.ToString(),
            inspection.Vehicle?.InternalNumber,
            inspection.Vehicle?.Plate,
            inspection.Vehicle?.Type,
            inspection.Template?.Name,
            inspection.TemplateVersion.ToString(CultureInfo.InvariantCulture),
            inspection.State.ToString(),
            Timestamp(inspection.StartedAt),
            inspection.FinalizedAt is null ? null : Timestamp(inspection.FinalizedAt.Value),
            Timestamp(inspection.ReceivedAt),
            inspection.CreatedBy?.Name,
            inspection.DeviceId,
            inspection.OdometerKm.ToString(CultureInfo.InvariantCulture),
            photoState,
            item?.ItemId.ToString(),
            item is null ? null : itemLabels.GetValueOrDefault(item.ItemId),
            item?.Status.ToString(),
            item?.Value?.ToString(CultureInfo.InvariantCulture),
            item?.Notes,
            inspection.Notes,
        ];

        return string.Join(',', cells.Select(Cell));
    }

    private static string Timestamp(DateTimeOffset value)
        => value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);

    /// <summary>
    /// Neutralizes spreadsheet formula execution. Excel and LibreOffice skip leading whitespace and
    /// control characters before deciding a cell is a formula, so the first *significant* character
    /// is what matters — checking only index 0 lets " =cmd" through.
    /// </summary>
    internal static string Cell(string? value)
    {
        value ??= string.Empty;

        var firstSignificant = value.AsSpan().IndexOfAnyExcept(
            [' ', '\t', '\r', '\n', '\v', '\f', '\0']);

        if (firstSignificant >= 0 && value[firstSignificant] is '=' or '+' or '-' or '@')
        {
            value = "'" + value;
        }
        else if (value.Length > 0 && char.IsControl(value[0]) && value[0] is not ('\r' or '\n' or '\t'))
        {
            value = "'" + value;
        }

        return '"' + value.Replace("\"", "\"\"") + '"';
    }
}
