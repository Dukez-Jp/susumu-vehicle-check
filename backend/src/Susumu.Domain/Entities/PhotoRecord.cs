namespace Susumu.Domain.Entities;

/// <summary>
/// Attachment metadata. Bytes live in file storage, never in PostgreSQL. A row is created when the
/// client declares the photo and completed when verified bytes arrive; content is then immutable.
/// </summary>
public sealed class PhotoRecord
{
    public Guid Id { get; set; }
    public Guid InspectionId { get; set; }
    public Guid? ItemId { get; set; }
    public PhotoKind Kind { get; set; }

    /// <summary>Required for <see cref="PhotoKind.Annotation"/>; the untouched original it was drawn over.</summary>
    public Guid? OriginalPhotoId { get; set; }

    public string? ContentType { get; set; }
    public string? Sha256 { get; set; }
    public long? SizeBytes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public bool Uploaded { get; set; }
    public DateTimeOffset? UploadedAt { get; set; }

    /// <summary>Relative path derived from ids only; user-supplied filenames are never used.</summary>
    public string? StoragePath { get; set; }

    public Guid DeclaredByUserId { get; set; }

    public Inspection? Inspection { get; set; }
}
