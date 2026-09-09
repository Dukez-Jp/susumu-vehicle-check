namespace Susumu.Domain.Entities;

/// <summary>
/// Server-side receipt of a client outbox operation. Written in the same transaction as the
/// inspection change, so a retry after a lost response replays the stored answer instead of
/// applying the work twice.
/// </summary>
public sealed class SyncOperationReceipt
{
    public Guid OperationId { get; set; }
    public Guid UserId { get; set; }
    public string DeviceId { get; set; } = string.Empty;

    /// <summary>SHA-256 over the canonical operation payload; a different payload on the same id is a conflict.</summary>
    public string PayloadHash { get; set; } = string.Empty;

    public Guid InspectionId { get; set; }

    /// <summary>Exact JSON returned the first time, replayed verbatim on retry.</summary>
    public string ResponseJson { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
