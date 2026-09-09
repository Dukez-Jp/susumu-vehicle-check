namespace Susumu.Domain.Entities;

/// <summary>
/// One row is one immutable-once-published template version. A new version is a new row that
/// shares (CompanyId, VehicleType, Name); inspections pin the exact row id.
/// </summary>
public sealed class ChecklistTemplate
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string VehicleType { get; set; } = string.Empty;
    public int Version { get; set; }
    public bool Published { get; set; }
    public bool RequiresSignature { get; set; }

    /// <summary>
    /// Availability for new work. Retiring a published version stops offering it in bootstrap; it
    /// never changes the frozen definition and never invalidates inspections already pinned to it.
    /// </summary>
    public bool Active { get; set; } = true;

    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid CreatedByUserId { get; set; }

    public ICollection<ChecklistSection> Sections { get; set; } = new List<ChecklistSection>();
}

public sealed class ChecklistSection
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int OrderIndex { get; set; }

    public ChecklistTemplate? Template { get; set; }
    public ICollection<ChecklistItem> Items { get; set; } = new List<ChecklistItem>();
}

public sealed class ChecklistItem
{
    /// <summary>The classification a template offers when it does not restrict the options.</summary>
    public static readonly IReadOnlyList<ItemStatus> StandardStatuses =
    [
        ItemStatus.OK,
        ItemStatus.Attention,
        ItemStatus.Repair,
        ItemStatus.Critical,
        ItemStatus.NotApplicable,
    ];

    public Guid Id { get; set; }
    public Guid SectionId { get; set; }
    public string Label { get; set; } = string.Empty;
    public ResponseType ResponseType { get; set; }
    public bool Required { get; set; }
    public string? Unit { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public int OrderIndex { get; set; }

    /// <summary>
    /// Exact answer options pinned to this template version, in the order they were configured, or
    /// <c>null</c> for "the five standard statuses". Rows written before the field existed stay null:
    /// they are not backfilled, because an explicit list would claim a decision nobody made.
    /// </summary>
    public IReadOnlyList<ItemStatus>? AllowedStatuses { get; set; }

    /// <summary>The options actually offered, resolving the null default. Not persisted.</summary>
    public IReadOnlyList<ItemStatus> EffectiveStatuses => AllowedStatuses ?? StandardStatuses;

    /// <summary>Not persisted; the pinned options decide, never the enum definition.</summary>
    public bool Allows(ItemStatus status) => EffectiveStatuses.Contains(status);

    public ChecklistSection? Section { get; set; }
}
