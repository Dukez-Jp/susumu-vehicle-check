using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;

namespace Susumu.Infrastructure.Services;

public sealed class InspectionQueryService(SusumuDbContext db)
{
    public async Task<IReadOnlyList<InspectionDto>> ListAsync(
        CurrentUser actor,
        Guid? vehicleId,
        InspectionState? state,
        Guid? supersedesInspectionId,
        int? offset,
        int? limit,
        CancellationToken ct)
    {
        var (skip, take) = Paging.Validate(offset, limit);

        var query = db.Inspections.AsNoTracking().InScope(actor);

        if (vehicleId is not null)
        {
            query = query.Where(i => i.VehicleId == vehicleId.Value);
        }

        if (state is not null)
        {
            query = query.Where(i => i.State == state.Value);
        }

        if (supersedesInspectionId is not null)
        {
            // Explicit relationship filter: a report must never infer "no correction exists" from a
            // recent-history window that simply did not reach far enough back.
            query = query.Where(i => i.SupersedesInspectionId == supersedesInspectionId.Value);
        }

        var inspections = await query
            .Include(i => i.Items)
            .Include(i => i.Photos)
            .Include(i => i.CreatedBy)
            .OrderByDescending(i => i.StartedAt)
            .ThenByDescending(i => i.Id)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

        return await ProjectAsync(actor, inspections, ct);
    }

    public async Task<InspectionDto> GetAsync(CurrentUser actor, Guid id, CancellationToken ct)
    {
        var inspection = await db.Inspections.AsNoTracking().InScope(actor)
            .Include(i => i.Items)
            .Include(i => i.Photos)
            .Include(i => i.CreatedBy)
            .FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw AppException.NotFound($"Inspection {id} was not found in your scope.");

        return (await ProjectAsync(actor, [inspection], ct)).Single();
    }

    /// <summary>
    /// Resolves the superseding correction for the returned rows in one query, so a report can show
    /// the banner without paging through the vehicle's whole history looking for it.
    /// </summary>
    private async Task<IReadOnlyList<InspectionDto>> ProjectAsync(
        CurrentUser actor, IReadOnlyList<Inspection> inspections, CancellationToken ct)
    {
        if (inspections.Count == 0)
        {
            return [];
        }

        var ids = inspections.Select(i => i.Id).ToList();
        var corrections = await db.Inspections.AsNoTracking().InScope(actor)
            .Where(i => i.SupersedesInspectionId != null
                        && ids.Contains(i.SupersedesInspectionId!.Value)
                        && i.State == InspectionState.Finalized)
            .Select(i => new { Original = i.SupersedesInspectionId!.Value, Correction = i.Id })
            .ToListAsync(ct);

        var bySuperseded = corrections
            .GroupBy(c => c.Original)
            .ToDictionary(g => g.Key, g => g.First().Correction);

        return inspections
            .Select(i => i.ToDto(
                supersededByInspectionId: bySuperseded.TryGetValue(i.Id, out var correction) ? correction : null))
            .ToList();
    }
}
