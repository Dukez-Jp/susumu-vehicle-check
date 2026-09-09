namespace Susumu.Domain.Entities;

/// <summary>Append-only record of security and business relevant operations.</summary>
public sealed class AuditEntry
{
    public Guid Id { get; set; }
    public Guid? ActorId { get; set; }
    public Guid? CompanyId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }

    /// <summary>Redundant link so inspection audit trails can be queried without parsing details.</summary>
    public Guid? InspectionId { get; set; }

    public DateTimeOffset At { get; set; }

    /// <summary>Short human-readable context. Never contains passwords, tokens or photo bytes.</summary>
    public string? Details { get; set; }
}

public static class AuditActions
{
    public const string LoginSucceeded = "auth.login.succeeded";
    public const string LoginFailed = "auth.login.failed";
    public const string InspectionCreated = "inspection.created";
    public const string InspectionUpdated = "inspection.updated";
    public const string InspectionFinalized = "inspection.finalized";
    public const string InspectionCorrected = "inspection.corrected";
    public const string InspectionReplayed = "inspection.sync.replayed";
    public const string InspectionClockSkew = "inspection.clock.skew";
    public const string PhotoUploaded = "photo.uploaded";
    public const string TemplateCreated = "template.created";
    public const string TemplatePublished = "template.published";
    public const string TemplateRetired = "template.retired";
    public const string TemplateActivated = "template.activated";
    public const string VehicleCreated = "vehicle.created";
    public const string VehicleUpdated = "vehicle.updated";
    public const string UserCreated = "user.created";
    public const string UserUpdated = "user.updated";
    public const string UserPasswordReset = "user.password.reset";
    public const string InitialProvisioning = "installation.provisioned";
}
