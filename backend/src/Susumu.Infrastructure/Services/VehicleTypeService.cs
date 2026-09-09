using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Services;

public sealed class VehicleTypeService(SusumuDbContext db, IClock clock)
{
    public async Task<IReadOnlyList<VehicleTypeDto>> ListAsync(CurrentUser actor, CancellationToken ct)
        => await db.Set<VehicleType>().AsNoTracking().Where(t => t.CompanyId == actor.CompanyId)
            .OrderBy(t => t.Name).ThenBy(t => t.Code)
            .Select(t => new VehicleTypeDto(t.Id, t.Code, t.Name, t.Active)).ToListAsync(ct);

    /// <summary>Call under the shared company write transaction when creating/changing an assignment.</summary>
    public static async Task<string> ResolveActiveCodeAsync(
        SusumuDbContext context, Guid companyId, string? code, CancellationToken ct)
    {
        var normalized = NormalizeCode(code);
        return await context.Set<VehicleType>().AsNoTracking()
            .Where(t => t.CompanyId == companyId && t.NormalizedCode == normalized && t.Active)
            .Select(t => t.Code).SingleOrDefaultAsync(ct)
            ?? throw AppException.Validation("Select an active vehicle type in your company.",
                new Dictionary<string, string[]> { ["code"] = ["Unknown or inactive vehicle type."] });
    }

    public Task<VehicleTypeDto> CreateAsync(CurrentUser actor, CreateVehicleTypeRequest request, CancellationToken ct)
        => WriteAsync(actor, () =>
        {
            var code = RequiredText(request.Code, "code", 80);
            var type = new VehicleType
            {
                Id = Guid.NewGuid(), CompanyId = actor.CompanyId, Code = code, NormalizedCode = NormalizeCode(code),
                Name = RequiredText(request.Name, "name", 120), Active = true,
                CreatedAt = clock.UtcNow, UpdatedAt = clock.UtcNow, Version = 1,
            };
            db.Set<VehicleType>().Add(type);
            db.AuditEntries.Add(Audit.Entry(clock.UtcNow, actor.Id, actor.CompanyId,
                "vehicle-type.created", "vehicle-type", type.Id, details: $"code={type.Code}"));
            return Task.FromResult(ToDto(type));
        }, ct);

    public Task<VehicleTypeDto> UpdateAsync(CurrentUser actor, Guid id, UpdateVehicleTypeRequest request, CancellationToken ct)
        => WriteAsync(actor, async () =>
        {
            var type = await db.Set<VehicleType>().SingleOrDefaultAsync(t => t.Id == id && t.CompanyId == actor.CompanyId, ct)
                ?? throw AppException.NotFound("Vehicle type was not found in your company.");
            type.Name = RequiredText(request.Name, "name", 120);
            type.Active = request.Active ?? throw AppException.Validation("active is required.",
                new Dictionary<string, string[]> { ["active"] = ["Required."] });
            type.UpdatedAt = clock.UtcNow;
            type.Version++;
            db.AuditEntries.Add(Audit.Entry(clock.UtcNow, actor.Id, actor.CompanyId,
                "vehicle-type.updated", "vehicle-type", type.Id, details: $"code={type.Code}; active={type.Active}"));
            return ToDto(type);
        }, ct);

    private async Task<T> WriteAsync<T>(CurrentUser actor, Func<Task<T>> operation, CancellationToken ct)
    {
        if (!actor.IsAdministrator) { throw AppException.Forbidden("Only administrators can manage vehicle types."); }
        await using var transaction = await OrganizationAdministrationService.BeginCompanyWriteAsync(db, actor.CompanyId, ct);
        await OrganizationAdministrationService.RequireActiveAdministratorAsync(db, actor, ct);
        try
        {
            var result = await operation();
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return result;
        }
        catch (DbUpdateException)
        {
            throw AppException.Conflict("Vehicle type code already exists in this company or the catalog was changed concurrently.");
        }
    }

    public static string NormalizeCode(string? code) => RequiredText(code, "code", 80).ToUpperInvariant();

    private static string RequiredText(string? value, string field, int maximum)
    {
        var text = value?.Trim() ?? string.Empty;
        if (text.Length is 0 || text.Length > maximum || text.Any(char.IsControl))
        {
            throw AppException.Validation("Invalid vehicle type payload.",
                new Dictionary<string, string[]> { [field] = [$"Required, at most {maximum} characters, without control characters."] });
        }

        return text;
    }

    private static VehicleTypeDto ToDto(VehicleType type) => new(type.Id, type.Code, type.Name, type.Active);
}
