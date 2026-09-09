namespace Susumu.Domain.Entities;

public sealed class Inspection
{
    /// <summary>Client-generated UUID so an inspection created offline keeps one identity forever.</summary>
    public Guid Id { get; set; }

    public Guid CompanyId { get; set; }
    public Guid LocationId { get; set; }
    public Guid VehicleId { get; set; }

    /// <summary>Exact template version row pinned at creation; never repointed.</summary>
    public Guid TemplateId { get; set; }

    public int TemplateVersion { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public int OdometerKm { get; set; }
    public InspectionState State { get; set; } = InspectionState.Draft;
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinalizedAt { get; set; }
    public string? Notes { get; set; }

    /// <summary>Set when this inspection corrects a finalized one; the original is left intact.</summary>
    public Guid? SupersedesInspectionId { get; set; }

    public string? CorrectionReason { get; set; }

    /// <summary>
    /// Declared signature attachment. Declaring it is enough to finalize offline; the bytes may
    /// arrive later. Once finalized it can never be changed, removed or rebound.
    /// </summary>
    public Guid? SignaturePhotoId { get; set; }

    /// <summary>Optimistic concurrency token. Server assigns 1 on creation and increments per accepted change.</summary>
    public int Version { get; set; }

    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Vehicle? Vehicle { get; set; }
    public ChecklistTemplate? Template { get; set; }
    public AppUser? CreatedBy { get; set; }
    public ICollection<InspectionItemRecord> Items { get; set; } = new List<InspectionItemRecord>();
    public ICollection<PhotoRecord> Photos { get; set; } = new List<PhotoRecord>();
}

public sealed class InspectionItemRecord
{
    public Guid Id { get; set; }
    public Guid InspectionId { get; set; }

    /// <summary>Checklist item id from the pinned template version.</summary>
    public Guid ItemId { get; set; }

    public ItemStatus Status { get; set; }
    public decimal? Value { get; set; }
    public string? Notes { get; set; }

    public Inspection? Inspection { get; set; }
}
