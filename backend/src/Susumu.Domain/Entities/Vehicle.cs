namespace Susumu.Domain.Entities;

public sealed class Vehicle
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid LocationId { get; set; }

    /// <summary>Workshop number painted on the vehicle, e.g. the synthetic DEV fixture "714".</summary>
    public string InternalNumber { get; set; } = string.Empty;

    public string? Plate { get; set; }
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Last accepted reading. Mapped as a concurrency token: two finalizations that both read the
    /// same value cannot both commit, so a concurrent lower write can never silently regress it.
    /// </summary>
    public int? CurrentOdometerKm { get; set; }
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
