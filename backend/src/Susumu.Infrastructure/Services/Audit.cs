using Susumu.Domain.Entities;

namespace Susumu.Infrastructure.Services;

public static class Audit
{
    /// <summary>
    /// Builds an append-only audit row. Callers add it inside the same transaction as the change it
    /// describes, so an audited operation and its evidence commit or fail together.
    /// </summary>
    public static AuditEntry Entry(
        DateTimeOffset at,
        Guid? actorId,
        Guid? companyId,
        string action,
        string entityType,
        Guid? entityId,
        Guid? inspectionId = null,
        string? details = null) => new()
        {
            Id = Guid.NewGuid(),
            At = at,
            ActorId = actorId,
            CompanyId = companyId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            InspectionId = inspectionId,
            Details = Truncate(details, 2000),
        };

    private static string? Truncate(string? value, int max)
        => value is null || value.Length <= max ? value : value[..max];
}
