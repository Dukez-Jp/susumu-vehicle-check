namespace Susumu.Domain.Contracts;

/// <summary>
/// Wire shapes fixed by docs/IMPLEMENTATION_CONTRACT.md. Property names serialize to camelCase.
/// Renaming or removing a member here breaks the mobile and web clients.
/// </summary>
public sealed record UserDto(
    Guid Id,
    string Name,
    string Username,
    UserRole Role,
    Guid CompanyId,
    Guid LocationId,
    bool Active);

public sealed record VehicleDto(
    Guid Id,
    string InternalNumber,
    string? Plate,
    string Type,
    Guid CompanyId,
    Guid LocationId,
    int? CurrentOdometerKm,
    bool Active);

public sealed record ChecklistItemDto(
    Guid Id,
    string Label,
    ResponseType ResponseType,
    bool Required,
    string? Unit,
    decimal? MinValue,
    decimal? MaxValue,

    /// <summary>
    /// The answer options this item offers, frozen with the template version. <c>null</c> means the
    /// five standard statuses and is what every template written before this field existed reports,
    /// so a cached client keeps working unchanged. Never rewritten into an explicit list on read.
    /// </summary>
    IReadOnlyList<ItemStatus>? AllowedStatuses = null);

public sealed record ChecklistSectionDto(
    Guid Id,
    string Title,
    IReadOnlyList<ChecklistItemDto> Items);

public sealed record ChecklistTemplateDto(
    Guid Id,
    string Name,
    string VehicleType,
    int Version,
    bool Published,
    bool RequiresSignature,
    bool Active,
    IReadOnlyList<ChecklistSectionDto> Sections);

public sealed record InspectionItemDto(
    Guid ItemId,
    ItemStatus? Status,
    decimal? Value,
    string? Notes,
    IReadOnlyList<Guid>? PhotoIds);

public sealed record PhotoDto(
    Guid Id,
    Guid InspectionId,
    Guid? ItemId,
    PhotoKind Kind,
    Guid? OriginalPhotoId,
    string? ContentType,
    string? Sha256,
    long? SizeBytes,
    DateTimeOffset CreatedAt,
    bool Uploaded);

/// <summary>
/// Both the client payload and the server projection. Server-owned members
/// (<see cref="CreatedBy"/>, <see cref="ReceivedAt"/>, <see cref="Version"/>, ...) are ignored on input.
/// </summary>
public sealed record InspectionDto(
    Guid Id,
    Guid VehicleId,
    Guid TemplateId,
    int TemplateVersion,
    string DeviceId,
    int OdometerKm,
    InspectionState State,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinalizedAt,
    IReadOnlyList<InspectionItemDto> Items,
    string? Notes,
    Guid? SupersedesInspectionId,
    string? CorrectionReason,
    int Version,
    Guid? SignaturePhotoId = null,
    Guid? CreatedBy = null,
    string? CreatedByName = null,
    DateTimeOffset? ReceivedAt = null,
    PhotoUploadState PhotoUploadState = PhotoUploadState.Pending,
    IReadOnlyList<PhotoDto>? Photos = null,

    /// <summary>
    /// Server projection: the finalized inspection that corrects this one, when there is one. Lets a
    /// report show the superseded banner without scanning a truncated history window.
    /// </summary>
    Guid? SupersededByInspectionId = null);

public sealed record LoginRequest(string? Username, string? Password, string? DeviceId);

public sealed record LoginResponse(
    string AccessToken,
    DateTimeOffset ExpiresAt,
    DateTimeOffset OfflineUntil,
    UserDto User);

public sealed record BootstrapResponse(
    UserDto User,
    IReadOnlyList<VehicleDto> Vehicles,
    IReadOnlyList<ChecklistTemplateDto> Templates,
    DateTimeOffset ServerTime);

public sealed record SyncInspectionRequest(
    Guid OperationId,
    int ExpectedVersion,
    InspectionDto? Inspection);

public sealed record SyncInspectionResponse(
    Guid InspectionId,
    int Version,
    InspectionState State,
    DateTimeOffset ReceivedAt,
    PhotoUploadState PhotoUploadState);

public sealed record DashboardResponse(
    int Vehicles,
    int Inspections,
    int Drafts,
    int Finalized,
    int CriticalItems,
    int PendingPhotos,
    IReadOnlyList<InspectionDto> RecentInspections);

public sealed record AuditEntryDto(
    Guid Id,
    Guid? ActorId,
    string Action,
    Guid? EntityId,
    DateTimeOffset At,
    string? Details);

public sealed record VehicleWriteRequest(
    string? InternalNumber,
    string? Plate,
    string? Type,
    Guid? LocationId,
    int? CurrentOdometerKm,
    bool? Active);

/// <summary>
/// Enums are nullable throughout the write DTOs on purpose: a member missing from the JSON silently
/// becomes the zero value, which would turn an omitted <c>responseType</c> into <c>status</c> and an
/// omitted <c>role</c> into <c>Administrator</c>. The services reject null explicitly instead.
/// </summary>
public sealed record ChecklistItemWriteDto(
    Guid? Id,
    string? Label,
    ResponseType? ResponseType,
    bool Required,
    string? Unit,
    decimal? MinValue,
    decimal? MaxValue,

    /// <summary>
    /// Optional subset of the standard classification. Omitted or null keeps all five statuses; an
    /// explicit list must be non-empty, distinct and defined, and a required item must offer at
    /// least one option other than <see cref="ItemStatus.NotApplicable"/>. Stored verbatim, in the
    /// submitted order, with the template version.
    /// </summary>
    IReadOnlyList<ItemStatus>? AllowedStatuses = null);

public sealed record ChecklistSectionWriteDto(
    Guid? Id,
    string? Title,
    IReadOnlyList<ChecklistItemWriteDto>? Items);

public sealed record TemplateWriteRequest(
    string? Name,
    string? VehicleType,
    bool RequiresSignature,
    IReadOnlyList<ChecklistSectionWriteDto>? Sections);

public sealed record CreateUserRequest(
    string? Name,
    string? Username,
    string? Password,
    UserRole? Role,
    Guid? LocationId);

public sealed record UpdateUserRequest(
    string? Name,
    UserRole? Role,
    bool? Active,
    string? Password);

/// <summary>Photo metadata part of the multipart upload.</summary>
public sealed record PhotoUploadMetadata(
    Guid? Id,
    Guid? ItemId,
    PhotoKind? Kind,
    Guid? OriginalPhotoId,
    string? ContentType,
    string? Sha256,
    long? SizeBytes,
    DateTimeOffset? CreatedAt);
