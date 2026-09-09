namespace Susumu.Domain.Entities;

public sealed class Company
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Serialization point for account administration. Every role/active/password change bumps it
    /// under a concurrency token, so two administrators cannot each demote the other after both read
    /// "one other administrator still exists" and leave the company with none.
    /// </summary>
    public int AdministrationStamp { get; set; }

    public ICollection<Location> Locations { get; set; } = new List<Location>();
}

public sealed class Location
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }

    public Company? Company { get; set; }
}

/// <summary>
/// Known tablets. Recorded for audit and for binding sync operations to a device;
/// it is not an authentication factor in V1.
/// </summary>
public sealed class DeviceRecord
{
    public string DeviceId { get; set; } = string.Empty;
    public Guid? LastUserId { get; set; }
    public DateTimeOffset FirstSeenAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
}
