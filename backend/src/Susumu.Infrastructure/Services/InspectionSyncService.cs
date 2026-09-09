using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Services;

/// <summary>
/// Receiving end of the client outbox. One call applies one frozen client operation exactly once:
/// the inspection change, its sync receipt and its audit rows commit in a single transaction, and a
/// repeat of the same operation replays the stored answer instead of doing the work twice.
/// </summary>
public sealed class InspectionSyncService(SusumuDbContext db, IClock clock)
{
    /// <summary>Difference beyond which a client timestamp is recorded as suspicious in the audit log.</summary>
    public static readonly TimeSpan SuspiciousClockSkew = TimeSpan.FromMinutes(5);

    /// <summary>Hard plausibility window. Outside it the timestamp is data corruption, not drift.</summary>
    public static readonly DateTimeOffset EarliestPlausibleTimestamp = new(2020, 1, 1, 0, 0, 0, TimeSpan.Zero);

    public static readonly TimeSpan MaxFutureTimestamp = TimeSpan.FromDays(1);

    /// <summary>Guards against a typo turning into a permanent, unfixable odometer for the vehicle.</summary>
    public const int MaxOdometerJumpKm = 200_000;

    public const int MaxItemsPerInspection = 2_000;
    public const int MaxPhotosPerItem = 50;
    public const int MaxDeclaredPhotos = 500;
    public const int MaxCorrectionReasonLength = 1_000;

    /// <summary>
    /// Retries for a lost-update conflict on the vehicle row. Nothing was committed, so replaying the
    /// same operation is safe, and it spares the client a 409 for a race it did not cause.
    /// </summary>
    private const int VehicleConflictRetries = 3;

    public async Task<SyncResult> ApplyAsync(
        CurrentUser actor, string? tokenDeviceId, SyncInspectionRequest request, CancellationToken ct)
    {
        var payload = ValidateRequest(actor, tokenDeviceId, request);
        var deviceId = payload.DeviceId!;
        var hash = CanonicalPayload.Hash(request);

        for (var attempt = 0; ; attempt++)
        {
            db.ChangeTracker.Clear();

            try
            {
                return await ApplyOnceAsync(actor, request, payload, deviceId, hash, ct);
            }
            catch (VehicleOdometerConflictException) when (attempt < VehicleConflictRetries)
            {
                // Another finalization for the same vehicle committed first. Re-read and re-apply.
            }
            catch (AppException conflict) when (conflict.Status == 409)
            {
                // The receipt lookup can miss just before an identical request commits. A later
                // inspection read then observes its new version/finalized state and rejects before
                // SaveChanges, outside the database-conflict handlers below. ApplyOnceAsync has
                // disposed its transaction here; re-read the committed receipt from a fresh view.
                // Replay still verifies the original actor, device and exact canonical payload.
                if (await TryReplayCommittedReceiptAsync(request, actor, deviceId, hash, ct) is { } replayed)
                {
                    return replayed;
                }

                throw;
            }
        }
    }

    private async Task<SyncResult> ApplyOnceAsync(
        CurrentUser actor,
        SyncInspectionRequest request,
        InspectionDto payload,
        string deviceId,
        string hash,
        CancellationToken ct)
    {
        var existingReceipt = await db.SyncOperations.AsNoTracking()
            .FirstOrDefaultAsync(o => o.OperationId == request.OperationId, ct);

        if (existingReceipt is not null)
        {
            return Replay(existingReceipt, actor, deviceId, hash);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var now = clock.UtcNow;
        var vehicle = await db.Vehicles.InScope(actor).FirstOrDefaultAsync(v => v.Id == payload.VehicleId, ct)
            ?? throw AppException.NotFound($"Vehicle {payload.VehicleId} was not found in your scope.");

        var template = await db.ChecklistTemplates.InScope(actor)
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .FirstOrDefaultAsync(t => t.Id == payload.TemplateId, ct)
            ?? throw AppException.NotFound($"Checklist template {payload.TemplateId} was not found in your scope.");

        ValidateTemplateForVehicle(template, vehicle, payload.TemplateVersion);

        var inspection = await db.Inspections
            .Include(i => i.Items)
            .Include(i => i.Photos)
            .FirstOrDefaultAsync(i => i.Id == payload.Id, ct);

        var created = false;
        var clockWarning = (string?)null;

        if (inspection is null)
        {
            if (request.ExpectedVersion != 0)
            {
                // The client believes the server already holds this inspection; it does not.
                throw AppException.Conflict(
                    "This inspection does not exist on the server, so expectedVersion must be 0.",
                    new Dictionary<string, string[]>
                    {
                        ["expectedVersion"] = ["Server has no record of this inspection."],
                    });
            }

            inspection = CreateInspection(actor, payload, vehicle, template, now, out clockWarning);
            created = true;
        }
        else
        {
            AuthorizeUpdate(actor, inspection, payload, request.ExpectedVersion, deviceId);
            ApplyDraftChanges(inspection, payload, now, out clockWarning);
        }

        var templateItems = template.Sections
            .SelectMany(s => s.Items)
            .ToDictionary(i => i.Id);

        ApplyItems(inspection, payload, templateItems);
        await ApplyDeclaredPhotosAsync(inspection, payload, actor, now, templateItems, ct);

        var finalizing = payload.State == InspectionState.Finalized && inspection.State != InspectionState.Finalized;
        if (finalizing)
        {
            await FinalizeAsync(actor, inspection, payload, vehicle, template, templateItems, now, ct);
        }

        inspection.ReceivedAt = now;
        inspection.UpdatedAt = now;

        var photoState = Mapping.UploadState(inspection.Photos);
        var response = new SyncInspectionResponse(
            inspection.Id, inspection.Version, inspection.State, now, photoState);

        db.SyncOperations.Add(new SyncOperationReceipt
        {
            OperationId = request.OperationId,
            UserId = actor.Id,
            DeviceId = deviceId,
            PayloadHash = hash,
            InspectionId = inspection.Id,
            ResponseJson = JsonSerializer.Serialize(response, SusumuJson.Options),
            CreatedAt = now,
        });

        db.AuditEntries.Add(Audit.Entry(
            now, actor.Id, inspection.CompanyId,
            created ? AuditActions.InspectionCreated : AuditActions.InspectionUpdated,
            "inspection", inspection.Id, inspection.Id,
            $"operation={request.OperationId}; device={deviceId}; version={inspection.Version}"));

        if (clockWarning is not null)
        {
            // The client time is kept verbatim; the divergence is recorded so it stays explainable.
            db.AuditEntries.Add(Audit.Entry(
                now, actor.Id, inspection.CompanyId, AuditActions.InspectionClockSkew, "inspection",
                inspection.Id, inspection.Id, clockWarning));
        }

        if (finalizing)
        {
            db.AuditEntries.Add(Audit.Entry(
                now, actor.Id, inspection.CompanyId, AuditActions.InspectionFinalized, "inspection",
                inspection.Id, inspection.Id,
                $"odometerKm={inspection.OdometerKm}; items={inspection.Items.Count}; photoState={photoState}"));

            if (inspection.SupersedesInspectionId is not null)
            {
                db.AuditEntries.Add(Audit.Entry(
                    now, actor.Id, inspection.CompanyId, AuditActions.InspectionCorrected, "inspection",
                    inspection.SupersedesInspectionId, inspection.SupersedesInspectionId,
                    $"correctedBy={inspection.Id}; reason={inspection.CorrectionReason}"));
            }
        }

        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException concurrency)
        {
            await transaction.RollbackAsync(ct);

            // A concurrent identical retry may already have completed the work; replay it rather
            // than returning a conflict that would permanently block the device queue.
            if (await TryReplayCommittedReceiptAsync(request, actor, deviceId, hash, ct) is { } replayed)
            {
                return replayed;
            }

            if (concurrency.Entries.Any(entry => entry.Entity is Vehicle))
            {
                throw new VehicleOdometerConflictException();
            }

            throw AppException.Conflict(
                "The inspection changed on the server while this operation was being applied. Reload and retry.",
                new Dictionary<string, string[]> { ["expectedVersion"] = ["Stale version."] });
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(ct);

            if (await TryReplayCommittedReceiptAsync(request, actor, deviceId, hash, ct) is { } replayed)
            {
                return replayed;
            }

            throw AppException.Conflict("The operation could not be stored because of a conflicting record.");
        }

        return new SyncResult(response, Replayed: false);
    }

    private async Task<SyncResult?> TryReplayCommittedReceiptAsync(
        SyncInspectionRequest request, CurrentUser actor, string deviceId, string hash, CancellationToken ct)
    {
        db.ChangeTracker.Clear();

        var receipt = await db.SyncOperations.AsNoTracking()
            .FirstOrDefaultAsync(o => o.OperationId == request.OperationId, ct);

        return receipt is null ? null : Replay(receipt, actor, deviceId, hash);
    }

    private static SyncResult Replay(SyncOperationReceipt receipt, CurrentUser actor, string deviceId, string hash)
    {
        if (receipt.UserId != actor.Id || !string.Equals(receipt.DeviceId, deviceId, StringComparison.Ordinal))
        {
            throw AppException.Conflict(
                "This operationId was already used by a different user or device.");
        }

        if (!string.Equals(receipt.PayloadHash, hash, StringComparison.Ordinal))
        {
            throw AppException.Conflict(
                "This operationId was already used with a different payload. Use a new operationId for new work.",
                new Dictionary<string, string[]> { ["operationId"] = ["Payload does not match the stored operation."] });
        }

        var stored = JsonSerializer.Deserialize<SyncInspectionResponse>(receipt.ResponseJson, SusumuJson.Options)
            ?? throw new InvalidOperationException($"Stored sync receipt {receipt.OperationId} is unreadable.");

        return new SyncResult(stored, Replayed: true);
    }

    private InspectionDto ValidateRequest(CurrentUser actor, string? tokenDeviceId, SyncInspectionRequest request)
    {
        if (!actor.CanRecordInspections)
        {
            throw AppException.Forbidden("This account cannot record inspections.");
        }

        var errors = new Dictionary<string, string[]>();

        if (request.OperationId == Guid.Empty)
        {
            errors["operationId"] = ["Required."];
        }

        if (request.ExpectedVersion < 0)
        {
            errors["expectedVersion"] = ["Must be zero or greater."];
        }

        var payload = request.Inspection;
        if (payload is null)
        {
            errors["inspection"] = ["Required."];
            throw AppException.Validation("Invalid sync operation.", errors);
        }

        if (payload.Id == Guid.Empty)
        {
            errors["inspection.id"] = ["Required; generate the UUID on the client."];
        }

        if (payload.VehicleId == Guid.Empty)
        {
            errors["inspection.vehicleId"] = ["Required."];
        }

        if (payload.TemplateId == Guid.Empty)
        {
            errors["inspection.templateId"] = ["Required."];
        }

        EnsureDefined(payload.State, "inspection.state", errors);

        var deviceId = payload.DeviceId?.Trim();
        if (string.IsNullOrEmpty(deviceId) || deviceId.Length > 120)
        {
            errors["inspection.deviceId"] = ["Required, at most 120 characters."];
        }
        else if (!string.IsNullOrEmpty(tokenDeviceId) && !string.Equals(tokenDeviceId, deviceId, StringComparison.Ordinal))
        {
            // The operation is bound to actor + device; a token issued for another device cannot carry it.
            errors["inspection.deviceId"] = ["Does not match the device this token was issued for."];
        }

        if (payload.OdometerKm < 0)
        {
            errors["inspection.odometerKm"] = ["Must be zero or greater."];
        }

        if (payload.Notes is { Length: > 4000 })
        {
            errors["inspection.notes"] = ["At most 4000 characters."];
        }

        if (payload.CorrectionReason is { Length: > MaxCorrectionReasonLength })
        {
            errors["inspection.correctionReason"] = [$"At most {MaxCorrectionReasonLength} characters."];
        }

        if (payload.SignaturePhotoId == Guid.Empty)
        {
            errors["inspection.signaturePhotoId"] = ["Must be a real UUID or null."];
        }

        ValidateTimestamps(payload, errors);

        var items = payload.Items ?? [];
        if (items.Count > MaxItemsPerInspection)
        {
            errors["inspection.items"] = [$"At most {MaxItemsPerInspection} items."];
            throw AppException.Validation("Invalid sync operation.", errors);
        }

        var seen = new HashSet<Guid>();
        var declaredPhotos = 0;

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];

            if (!seen.Add(item.ItemId))
            {
                errors[$"inspection.items[{i}].itemId"] = ["Duplicated in payload."];
            }

            if (item.Status is not { } status)
            {
                errors[$"inspection.items[{i}].status"] = ["Required; an item without a status is not a response."];
            }
            else
            {
                EnsureDefined(status, $"inspection.items[{i}].status", errors);
            }

            if (item.Notes is { Length: > 2000 })
            {
                errors[$"inspection.items[{i}].notes"] = ["At most 2000 characters."];
            }

            ValidateMeasurement(item.Value, $"inspection.items[{i}].value", errors);

            var photoIds = item.PhotoIds ?? [];
            if (photoIds.Count > MaxPhotosPerItem)
            {
                errors[$"inspection.items[{i}].photoIds"] = [$"At most {MaxPhotosPerItem} photos per item."];
            }

            declaredPhotos += photoIds.Count;
        }

        if (declaredPhotos > MaxDeclaredPhotos)
        {
            errors["inspection.items"] = [$"At most {MaxDeclaredPhotos} declared photos per inspection."];
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation("Invalid sync operation.", errors);
        }

        return payload with { DeviceId = deviceId! };
    }

    /// <summary>
    /// Client times are the record of when the work actually happened, so they are never replaced by
    /// server time. They must be present and plausible; drift beyond <see cref="SuspiciousClockSkew"/>
    /// is kept but audited.
    /// </summary>
    private void ValidateTimestamps(InspectionDto payload, IDictionary<string, string[]> errors)
    {
        var now = clock.UtcNow;

        if (payload.StartedAt == default)
        {
            errors["inspection.startedAt"] = ["Required; send the time the inspection was started on the device."];
        }
        else if (!IsPlausible(payload.StartedAt, now))
        {
            errors["inspection.startedAt"] = [PlausibilityMessage(now)];
        }

        if (payload.FinalizedAt is { } finalizedAt)
        {
            if (finalizedAt == default)
            {
                errors["inspection.finalizedAt"] = ["Send a real timestamp or null."];
            }
            else if (!IsPlausible(finalizedAt, now))
            {
                errors["inspection.finalizedAt"] = [PlausibilityMessage(now)];
            }
            else if (payload.StartedAt != default && finalizedAt < payload.StartedAt)
            {
                errors["inspection.finalizedAt"] = ["An inspection cannot be finalized before it was started."];
            }
        }

        if (payload.State == InspectionState.Finalized && payload.FinalizedAt is null)
        {
            errors["inspection.finalizedAt"] = ["Required when state is Finalized."];
        }
    }

    private static bool IsPlausible(DateTimeOffset value, DateTimeOffset now)
        => value >= EarliestPlausibleTimestamp && value <= now.Add(MaxFutureTimestamp);

    private static string PlausibilityMessage(DateTimeOffset now)
        => $"Must be between {EarliestPlausibleTimestamp:yyyy-MM-dd} and {now.Add(MaxFutureTimestamp):yyyy-MM-dd}.";

    /// <summary>
    /// The persisted column is decimal(18,4). Accepting finer precision would silently round the
    /// stored value and let two genuinely different submissions share one idempotency hash.
    /// </summary>
    public static void ValidateMeasurement(decimal? value, string field, IDictionary<string, string[]> errors)
    {
        if (value is not { } number)
        {
            return;
        }

        if (Math.Abs(number) > 99_999_999_999_999m)
        {
            errors[field] = ["Out of the supported numeric range."];
            return;
        }

        if (decimal.Round(number, 4) != number)
        {
            errors[field] = ["At most 4 decimal places are stored; send a value the server can keep exactly."];
        }
    }

    private static void EnsureDefined<TEnum>(TEnum value, string field, IDictionary<string, string[]> errors)
        where TEnum : struct, Enum
    {
        if (!Enum.IsDefined(value))
        {
            errors[field] = ["Not a defined value."];
        }
    }

    private static void ValidateTemplateForVehicle(ChecklistTemplate template, Vehicle vehicle, int templateVersion)
    {
        // Note: a retired version is still accepted here. Retirement only stops offering the version
        // for new online selection; work already pinned to it must keep syncing.
        if (!template.Published)
        {
            throw AppException.Validation(
                "Inspections can only use published checklist template versions.",
                new Dictionary<string, string[]> { ["inspection.templateId"] = ["Template version is not published."] });
        }

        if (template.Version != templateVersion)
        {
            throw AppException.Validation(
                "templateVersion does not match the referenced template version row.",
                new Dictionary<string, string[]>
                {
                    ["inspection.templateVersion"] = [$"Template {template.Id} is version {template.Version}."],
                });
        }

        if (!string.Equals(template.VehicleType, vehicle.Type, StringComparison.OrdinalIgnoreCase))
        {
            throw AppException.Validation(
                "The checklist template does not apply to this vehicle type.",
                new Dictionary<string, string[]>
                {
                    ["inspection.templateId"] = [$"Template is for '{template.VehicleType}', vehicle is '{vehicle.Type}'."],
                });
        }
    }

    private Inspection CreateInspection(
        CurrentUser actor,
        InspectionDto payload,
        Vehicle vehicle,
        ChecklistTemplate template,
        DateTimeOffset now,
        out string? clockWarning)
    {
        if (!vehicle.Active)
        {
            throw AppException.Validation("This vehicle is inactive and cannot receive new inspections.");
        }

        clockWarning = DescribeSkew(payload, now);

        var inspection = new Inspection
        {
            Id = payload.Id,
            CompanyId = vehicle.CompanyId,
            LocationId = vehicle.LocationId,
            VehicleId = vehicle.Id,
            TemplateId = template.Id,
            TemplateVersion = template.Version,
            DeviceId = payload.DeviceId,
            OdometerKm = payload.OdometerKm,
            State = InspectionState.Draft,
            StartedAt = payload.StartedAt.ToUniversalTime(),
            Notes = payload.Notes,
            SupersedesInspectionId = payload.SupersedesInspectionId,
            CorrectionReason = payload.CorrectionReason,
            SignaturePhotoId = payload.SignaturePhotoId,
            Version = 1,
            CreatedByUserId = actor.Id,
            ReceivedAt = now,
            UpdatedAt = now,
        };

        db.Inspections.Add(inspection);
        return inspection;
    }

    private static void AuthorizeUpdate(
        CurrentUser actor, Inspection inspection, InspectionDto payload, int expectedVersion, string deviceId)
    {
        if (inspection.CompanyId != actor.CompanyId ||
            (!actor.IsCompanyWide && inspection.LocationId != actor.LocationId))
        {
            // Do not confirm that the identifier exists elsewhere.
            throw AppException.NotFound($"Inspection {payload.Id} was not found in your scope.");
        }

        if (inspection.CreatedByUserId != actor.Id)
        {
            throw AppException.Forbidden("This inspection belongs to another user and cannot be modified.");
        }

        if (!string.Equals(inspection.DeviceId, deviceId, StringComparison.Ordinal))
        {
            throw AppException.Conflict(
                "This inspection was started on another device. V1 does not support editing one inspection from two devices.");
        }

        if (inspection.State == InspectionState.Finalized)
        {
            throw AppException.Conflict(
                "Finalized inspections are immutable. Create a correction with supersedesInspectionId instead.");
        }

        if (inspection.VehicleId != payload.VehicleId || inspection.TemplateId != payload.TemplateId)
        {
            throw AppException.Conflict("An inspection cannot be repointed to another vehicle or template version.");
        }

        if (expectedVersion != inspection.Version)
        {
            throw AppException.Conflict(
                "expectedVersion does not match the stored inspection version.",
                new Dictionary<string, string[]>
                {
                    ["expectedVersion"] = [$"Server version is {inspection.Version}."],
                });
        }
    }

    /// <summary>Exactly one increment per accepted operation; a replayed receipt never reaches here.</summary>
    private void ApplyDraftChanges(
        Inspection inspection, InspectionDto payload, DateTimeOffset now, out string? clockWarning)
    {
        clockWarning = DescribeSkew(payload, now);

        inspection.OdometerKm = payload.OdometerKm;
        inspection.Notes = payload.Notes;
        inspection.StartedAt = payload.StartedAt.ToUniversalTime();
        inspection.SupersedesInspectionId = payload.SupersedesInspectionId;
        inspection.CorrectionReason = payload.CorrectionReason;
        inspection.SignaturePhotoId = payload.SignaturePhotoId;
        inspection.Version += 1;
    }

    private static string? DescribeSkew(InspectionDto payload, DateTimeOffset now)
    {
        var reference = payload.FinalizedAt ?? payload.StartedAt;
        var difference = reference - now;

        return difference.Duration() > SuspiciousClockSkew
            ? $"deviceClock={reference:O}; serverClock={now:O}; differenceSeconds={(long)difference.TotalSeconds}"
            : null;
    }

    private void ApplyItems(
        Inspection inspection, InspectionDto payload, IReadOnlyDictionary<Guid, ChecklistItem> templateItems)
    {
        var incoming = payload.Items ?? [];
        var unknown = incoming.Where(i => !templateItems.ContainsKey(i.ItemId)).Select(i => i.ItemId).ToList();
        if (unknown.Count > 0)
        {
            throw AppException.Validation(
                "The payload references checklist items that do not exist in the pinned template version.",
                new Dictionary<string, string[]>
                {
                    ["inspection.items"] = unknown.Select(id => $"Unknown item {id}.").ToArray(),
                });
        }

        foreach (var dto in incoming)
        {
            var item = templateItems[dto.ItemId];
            if (item.ResponseType == ResponseType.Status && dto.Value is not null)
            {
                throw AppException.Validation(
                    "Only measurement items accept a numeric value.",
                    new Dictionary<string, string[]> { [$"inspection.items.{dto.ItemId}.value"] = ["Item is not a measurement."] });
            }

            var existing = inspection.Items.FirstOrDefault(x => x.ItemId == dto.ItemId);
            if (existing is null)
            {
                inspection.Items.Add(new InspectionItemRecord
                {
                    Id = Guid.NewGuid(),
                    InspectionId = inspection.Id,
                    ItemId = dto.ItemId,
                    Status = dto.Status!.Value,
                    Value = dto.Value,
                    Notes = dto.Notes,
                });
            }
            else
            {
                existing.Status = dto.Status!.Value;
                existing.Value = dto.Value;
                existing.Notes = dto.Notes;
            }
        }

        var keep = incoming.Select(i => i.ItemId).ToHashSet();
        foreach (var removed in inspection.Items.Where(x => !keep.Contains(x.ItemId)).ToList())
        {
            inspection.Items.Remove(removed);
            db.InspectionItems.Remove(removed);
        }
    }

    /// <summary>
    /// Reconciles declared attachments, item photos and the signature alike. Placeholders are created
    /// so an upload can arrive later, which is what lets a tablet finalize offline; a declaration that
    /// disappears is only dropped while it has no bytes, because stored images are never deleted by a
    /// sync operation.
    /// </summary>
    private async Task ApplyDeclaredPhotosAsync(
        Inspection inspection,
        InspectionDto payload,
        CurrentUser actor,
        DateTimeOffset now,
        IReadOnlyDictionary<Guid, ChecklistItem> templateItems,
        CancellationToken ct)
    {
        var declared = new Dictionary<Guid, (Guid? ItemId, PhotoKind Kind)>();
        var errors = new Dictionary<string, string[]>();

        foreach (var item in payload.Items ?? [])
        {
            foreach (var photoId in item.PhotoIds ?? [])
            {
                if (photoId == Guid.Empty)
                {
                    throw AppException.Validation("photoIds cannot contain an empty UUID.");
                }

                // One photo belongs to exactly one item. Silently keeping the last association would
                // move the evidence to a different checklist line.
                if (declared.TryGetValue(photoId, out var already) && already.ItemId != item.ItemId)
                {
                    errors[$"inspection.items.{item.ItemId}.photoIds"] =
                        [$"Photo {photoId} is declared on more than one item."];
                    continue;
                }

                declared[photoId] = (item.ItemId, PhotoKind.Original);
            }
        }

        if (payload.SignaturePhotoId is { } signatureId)
        {
            if (declared.ContainsKey(signatureId))
            {
                throw AppException.Validation(
                    "signaturePhotoId cannot also appear in items[].photoIds; a signature is a separate attachment.",
                    new Dictionary<string, string[]> { ["inspection.signaturePhotoId"] = ["Already declared as an item photo."] });
            }

            declared[signatureId] = (null, PhotoKind.Signature);
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation("Invalid photo declarations.", errors);
        }

        // A photo id already bound to another inspection would silently move evidence between records.
        if (declared.Count > 0)
        {
            var ids = declared.Keys.ToList();
            var foreign = await db.Photos.AsNoTracking()
                .Where(p => ids.Contains(p.Id) && p.InspectionId != inspection.Id)
                .Select(p => p.Id)
                .FirstOrDefaultAsync(ct);

            if (foreign != Guid.Empty)
            {
                throw AppException.Conflict(
                    $"Photo {foreign} is already attached to another inspection. Generate a new photo id.");
            }
        }

        foreach (var (photoId, declaration) in declared)
        {
            if (declaration.ItemId is { } itemId && !templateItems.ContainsKey(itemId))
            {
                throw AppException.Validation(
                    $"Photo {photoId} is declared on an item that is not in the pinned template version.");
            }

            var existing = inspection.Photos.FirstOrDefault(p => p.Id == photoId);
            if (existing is null)
            {
                inspection.Photos.Add(new PhotoRecord
                {
                    Id = photoId,
                    InspectionId = inspection.Id,
                    ItemId = declaration.ItemId,
                    Kind = declaration.Kind,
                    CreatedAt = now,
                    Uploaded = false,
                    DeclaredByUserId = actor.Id,
                });
                continue;
            }

            // An attachment keeps the association it was declared with, for its whole life.
            if (existing.ItemId is null)
            {
                existing.ItemId = declaration.ItemId;
            }
            else if (declaration.ItemId is not null && existing.ItemId != declaration.ItemId)
            {
                throw AppException.Conflict(
                    $"Photo {photoId} is already attached to another checklist item and cannot be rebound.");
            }

            // items[].photoIds declares the item association, not whether the stored bytes are an
            // original or an annotation. Upload may already have resolved that pending distinction.
            // Repeating the same item id must preserve the annotation and its original reference;
            // signature/item transitions remain forbidden and no stored kind is rewritten here.
            var retainedAnnotation = declaration.ItemId is not null
                                     && declaration.Kind == PhotoKind.Original
                                     && existing.Kind == PhotoKind.Annotation;
            if (existing.Kind != declaration.Kind && !retainedAnnotation)
            {
                throw AppException.Conflict(
                    $"Photo {photoId} was declared as {existing.Kind} and cannot become {declaration.Kind}.");
            }
        }

        foreach (var orphan in inspection.Photos
                     .Where(p => !p.Uploaded && !declared.ContainsKey(p.Id))
                     .ToList())
        {
            inspection.Photos.Remove(orphan);
            db.Photos.Remove(orphan);
        }
    }

    private async Task FinalizeAsync(
        CurrentUser actor,
        Inspection inspection,
        InspectionDto payload,
        Vehicle vehicle,
        ChecklistTemplate template,
        IReadOnlyDictionary<Guid, ChecklistItem> templateItems,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var answers = inspection.Items.ToDictionary(i => i.ItemId);

        foreach (var item in templateItems.Values.OrderBy(i => i.OrderIndex))
        {
            answers.TryGetValue(item.Id, out var answer);

            if (item.Required && answer is null)
            {
                errors[$"items.{item.Id}"] = [$"Required item '{item.Label}' has no response."];
                continue;
            }

            if (answer is null)
            {
                continue;
            }

            // Checked only here, on the way to Finalized. Draft autosave keeps accepting whatever the
            // tablet holds - including the NotApplicable placeholder a fresh item starts with, even
            // when the pinned options exclude it - so offline work is never lost to this rule. The
            // options compared against are the ones frozen with this exact template version, and a
            // disallowed answer is rejected, never remapped to a neighbouring status.
            if (!item.Allows(answer.Status))
            {
                errors[$"items.{item.Id}.status"] =
                [
                    $"'{answer.Status}' is not an allowed option for '{item.Label}'. " +
                    $"Allowed: {string.Join(", ", item.EffectiveStatuses)}.",
                ];
            }

            if (item.ResponseType == ResponseType.Measurement)
            {
                if (item.Required && answer.Value is null && answer.Status != ItemStatus.NotApplicable)
                {
                    errors[$"items.{item.Id}.value"] = [$"Required measurement '{item.Label}' has no value."];
                }

                if (answer.Value is not null)
                {
                    if (item.MinValue is not null && answer.Value < item.MinValue)
                    {
                        errors[$"items.{item.Id}.value"] = [$"Below the allowed minimum {item.MinValue}."];
                    }

                    if (item.MaxValue is not null && answer.Value > item.MaxValue)
                    {
                        errors[$"items.{item.Id}.value"] = [$"Above the allowed maximum {item.MaxValue}."];
                    }
                }
            }
        }

        ValidateOdometerForFinalization(inspection.OdometerKm, vehicle.CurrentOdometerKm, errors);

        // Declaring the signature is enough: a tablet must be able to finalize offline, and the bytes
        // are chased separately through photoUploadState.
        if (template.RequiresSignature && inspection.SignaturePhotoId is null)
        {
            errors["signaturePhotoId"] = ["This checklist requires a signature before finalizing."];
        }

        if (inspection.SupersedesInspectionId is { } supersededId)
        {
            var superseded = await db.Inspections.AsNoTracking().InScope(actor)
                .FirstOrDefaultAsync(i => i.Id == supersededId, ct);

            if (superseded is null)
            {
                errors["supersedesInspectionId"] = ["The corrected inspection was not found in your scope."];
            }
            else
            {
                if (superseded.State != InspectionState.Finalized)
                {
                    errors["supersedesInspectionId"] = ["Only a finalized inspection can be corrected."];
                }

                if (superseded.VehicleId != inspection.VehicleId)
                {
                    errors["supersedesInspectionId"] = ["The corrected inspection belongs to another vehicle."];
                }

                var alreadyCorrected = await db.Inspections.AsNoTracking()
                    .AnyAsync(i => i.SupersedesInspectionId == supersededId
                                   && i.Id != inspection.Id
                                   && i.State == InspectionState.Finalized, ct);

                if (alreadyCorrected)
                {
                    errors["supersedesInspectionId"] = ["This inspection has already been corrected."];
                }
            }

            if (string.IsNullOrWhiteSpace(inspection.CorrectionReason) || inspection.CorrectionReason.Trim().Length < 5)
            {
                errors["correctionReason"] = ["A correction reason of at least 5 characters is required."];
            }
        }
        else if (!string.IsNullOrWhiteSpace(inspection.CorrectionReason))
        {
            errors["correctionReason"] = ["Only allowed together with supersedesInspectionId."];
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation("The inspection cannot be finalized yet.", errors);
        }

        inspection.State = InspectionState.Finalized;
        inspection.FinalizedAt = (payload.FinalizedAt ?? now).ToUniversalTime();

        // Only ever moves forward; the concurrency token on the column rejects a stale writer.
        if (vehicle.CurrentOdometerKm is not { } current || inspection.OdometerKm > current)
        {
            vehicle.CurrentOdometerKm = inspection.OdometerKm;
        }
    }

    /// <summary>
    /// A vehicle whose reading was never recorded accepts any non-negative value, including 0, which
    /// is what a tablet sends for a brand new vehicle. Once a reading exists the meter only moves
    /// forward, and not by an implausible jump. Compared in <see cref="long"/> so the ceiling cannot
    /// overflow near <see cref="int.MaxValue"/>.
    /// </summary>
    public static void ValidateOdometerForFinalization(
        int odometerKm, int? currentOdometerKm, IDictionary<string, string[]> errors)
    {
        if (odometerKm < 0)
        {
            errors["odometerKm"] = ["Must be zero or greater."];
            return;
        }

        if (currentOdometerKm is not { } current)
        {
            return;
        }

        if (odometerKm < current)
        {
            errors["odometerKm"] = [$"Lower than the last recorded reading ({current} km)."];
        }
        else if (odometerKm > (long)current + MaxOdometerJumpKm)
        {
            errors["odometerKm"] =
                [$"More than {MaxOdometerJumpKm} km above the last recorded reading ({current} km)."];
        }
    }
}

/// <summary>Internal signal that another writer changed the vehicle odometer first.</summary>
internal sealed class VehicleOdometerConflictException : Exception;

public sealed record SyncResult(SyncInspectionResponse Response, bool Replayed);
