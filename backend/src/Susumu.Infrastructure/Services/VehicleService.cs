using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Services;

public sealed class VehicleService(SusumuDbContext db, IClock clock)
{
    public const int MaxResults = 200;

    public async Task<IReadOnlyList<VehicleDto>> ListAsync(CurrentUser actor, string? search, CancellationToken ct)
    {
        var query = db.Vehicles.AsNoTracking().InScope(actor);

        search = search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            if (Guid.TryParse(search, out var id))
            {
                query = query.Where(v => v.Id == id);
            }
            else
            {
                // Contains (not Like) so the provider escapes the term: a search for "%" must not
                // widen the result set. Compared uppercase to stay case-insensitive on PostgreSQL.
                var term = search.ToUpperInvariant();
                query = query.Where(v =>
                    v.InternalNumber.ToUpper().Contains(term) ||
                    (v.Plate != null && v.Plate.ToUpper().Contains(term)));
            }
        }

        var vehicles = await query
            .OrderBy(v => v.InternalNumber)
            .Take(MaxResults)
            .ToListAsync(ct);

        return vehicles.Select(v => v.ToDto()).ToList();
    }

    public async Task<VehicleDto> GetAsync(CurrentUser actor, Guid id, CancellationToken ct)
    {
        var vehicle = await db.Vehicles.AsNoTracking().InScope(actor).FirstOrDefaultAsync(v => v.Id == id, ct)
            ?? throw AppException.NotFound($"Vehicle {id} was not found in your scope.");
        return vehicle.ToDto();
    }

    public async Task<VehicleDto> CreateAsync(CurrentUser actor, VehicleWriteRequest request, CancellationToken ct)
    {
        RequireAdministrator(actor);
        var (internalNumber, plate, type) = ValidateFields(request, requireAll: true);

        // Joins the company-wide serialization so a vehicle cannot be assigned to a location that a
        // concurrent request is deactivating.
        await using var transaction = await OrganizationAdministrationService.BeginCompanyWriteAsync(
            db, actor.CompanyId, ct);
        await OrganizationAdministrationService.RequireActiveAdministratorAsync(db, actor, ct);

        var locationId = await ResolveLocationAsync(actor, request.LocationId, ct);
        type = await VehicleTypeService.ResolveActiveCodeAsync(db, actor.CompanyId, type, ct);

        await EnsureInternalNumberFreeAsync(actor.CompanyId, internalNumber!, null, ct);

        var now = clock.UtcNow;
        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            CompanyId = actor.CompanyId,
            LocationId = locationId,
            InternalNumber = internalNumber!,
            Plate = plate,
            Type = type!,
            CurrentOdometerKm = ValidateOdometer(request.CurrentOdometerKm),
            Active = request.Active ?? true,
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.Vehicles.Add(vehicle);
        db.AuditEntries.Add(Audit.Entry(now, actor.Id, actor.CompanyId, AuditActions.VehicleCreated, "vehicle", vehicle.Id,
            details: $"internalNumber={vehicle.InternalNumber}"));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return vehicle.ToDto();
    }

    public async Task<VehicleDto> UpdateAsync(CurrentUser actor, Guid id, VehicleWriteRequest request, CancellationToken ct)
    {
        RequireAdministrator(actor);

        await using var transaction = await OrganizationAdministrationService.BeginCompanyWriteAsync(
            db, actor.CompanyId, ct);
        await OrganizationAdministrationService.RequireActiveAdministratorAsync(db, actor, ct);

        var vehicle = await db.Vehicles.InScope(actor).FirstOrDefaultAsync(v => v.Id == id, ct)
            ?? throw AppException.NotFound($"Vehicle {id} was not found in your scope.");

        var (internalNumber, plate, type) = ValidateFields(request, requireAll: false);

        if (internalNumber is not null && !string.Equals(internalNumber, vehicle.InternalNumber, StringComparison.Ordinal))
        {
            await EnsureInternalNumberFreeAsync(actor.CompanyId, internalNumber, vehicle.Id, ct);
            vehicle.InternalNumber = internalNumber;
        }

        if (request.Plate is not null)
        {
            vehicle.Plate = plate;
        }

        if (type is not null && !string.Equals(type, vehicle.Type, StringComparison.OrdinalIgnoreCase))
        {
            vehicle.Type = await VehicleTypeService.ResolveActiveCodeAsync(db, actor.CompanyId, type, ct);
        }

        if ((request.Active ?? vehicle.Active) || request.LocationId is not null)
        {
            // An active result always needs an active effective location, including reactivation
            // requests that omit locationId. Inactive historical records remain editable.
            vehicle.LocationId = await ResolveLocationAsync(actor, request.LocationId ?? vehicle.LocationId, ct);
        }

        if (request.CurrentOdometerKm is { } requested)
        {
            ValidateOdometer(requested);

            // A web edit opened before a finalization carries the reading it saw. Writing it back
            // unconditionally would put an older meter value on the vehicle, so the administrative
            // path enforces the same monotonic rule as finalization. A genuine meter replacement is
            // a separate audited operation, not an implicit lower write.
            if (vehicle.CurrentOdometerKm is { } current && requested < current)
            {
                throw AppException.Conflict(
                    $"The odometer cannot be lowered: the vehicle already reads {current} km.",
                    new Dictionary<string, string[]>
                    {
                        ["currentOdometerKm"] = [$"Current reading is {current} km."],
                    });
            }

            vehicle.CurrentOdometerKm = requested;
        }

        if (request.Active is not null)
        {
            vehicle.Active = request.Active.Value;
        }

        var now = clock.UtcNow;
        vehicle.UpdatedAt = now;
        db.AuditEntries.Add(Audit.Entry(now, actor.Id, actor.CompanyId, AuditActions.VehicleUpdated, "vehicle", vehicle.Id,
            details: $"internalNumber={vehicle.InternalNumber}; odometerKm={vehicle.CurrentOdometerKm}"));

        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The odometer column is a concurrency token: a finalization committed between our read
            // and our write, so this edit was based on a stale reading.
            throw AppException.Conflict(
                "The vehicle odometer changed while this edit was open. Reload the vehicle and try again.");
        }

        return vehicle.ToDto();
    }

    private static void RequireAdministrator(CurrentUser actor)
    {
        if (!actor.IsAdministrator)
        {
            throw AppException.Forbidden("Only administrators can manage vehicles.");
        }
    }

    private static int? ValidateOdometer(int? odometer)
    {
        if (odometer is < 0)
        {
            throw AppException.Validation("currentOdometerKm cannot be negative.",
                new Dictionary<string, string[]> { ["currentOdometerKm"] = ["Must be zero or greater."] });
        }

        return odometer;
    }

    private static (string? InternalNumber, string? Plate, string? Type) ValidateFields(
        VehicleWriteRequest request, bool requireAll)
    {
        var errors = new Dictionary<string, string[]>();
        var internalNumber = request.InternalNumber?.Trim();
        var plate = string.IsNullOrWhiteSpace(request.Plate) ? null : request.Plate.Trim().ToUpperInvariant();
        var type = request.Type?.Trim();

        if (requireAll && string.IsNullOrEmpty(internalNumber))
        {
            errors["internalNumber"] = ["Required."];
        }

        if (internalNumber is { Length: > 40 })
        {
            errors["internalNumber"] = ["At most 40 characters."];
        }

        if (requireAll && string.IsNullOrEmpty(type))
        {
            errors["type"] = ["Required."];
        }

        if (type is { Length: > 80 })
        {
            errors["type"] = ["At most 80 characters."];
        }

        if (plate is { Length: > 40 })
        {
            errors["plate"] = ["At most 40 characters."];
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation("Invalid vehicle payload.", errors);
        }

        return (string.IsNullOrEmpty(internalNumber) ? null : internalNumber, plate,
            string.IsNullOrEmpty(type) ? null : type);
    }

    private async Task<Guid> ResolveLocationAsync(CurrentUser actor, Guid? locationId, CancellationToken ct)
    {
        var effectiveLocationId = locationId ?? actor.LocationId;
        var usable = await db.Locations
            .AnyAsync(l => l.Id == effectiveLocationId && l.CompanyId == actor.CompanyId && l.Active, ct);

        if (!usable)
        {
            throw AppException.Validation("locationId does not belong to your company or is not active.",
                new Dictionary<string, string[]> { ["locationId"] = ["Unknown or inactive location."] });
        }

        return effectiveLocationId;
    }

    private async Task EnsureInternalNumberFreeAsync(Guid companyId, string internalNumber, Guid? exceptId, CancellationToken ct)
    {
        var taken = await db.Vehicles.AnyAsync(
            v => v.CompanyId == companyId && v.InternalNumber == internalNumber && (exceptId == null || v.Id != exceptId),
            ct);

        if (taken)
        {
            throw AppException.Conflict($"Vehicle internal number '{internalNumber}' already exists in this company.");
        }
    }
}
