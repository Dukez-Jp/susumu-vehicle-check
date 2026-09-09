using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Storage;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Services;

/// <summary>
/// Attachment ingestion. Bytes are verified against the declared checksum and the container's own
/// structure before anything is stored, written to an object that is never overwritten, and only
/// then recorded as uploaded.
/// </summary>
public sealed class PhotoService(
    SusumuDbContext db,
    IPhotoStorage storage,
    IOptions<PhotoStorageOptions> storageOptions,
    IClock clock)
{
    private static readonly HashSet<string> AllowedContentTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png" };

    private readonly long _maxBytes = storageOptions.Value.MaxBytes;

    public async Task<PhotoDto> UploadAsync(
        CurrentUser actor,
        Guid inspectionId,
        Guid photoId,
        PhotoUploadMetadata? metadata,
        Stream content,
        string? transportContentType,
        CancellationToken ct)
    {
        if (photoId == Guid.Empty)
        {
            throw AppException.Validation("photoId is required.");
        }

        if (metadata?.Id is { } declaredId && declaredId != photoId)
        {
            throw AppException.Validation("metadata.id does not match the photoId in the URL.");
        }

        if (metadata?.Kind is { } declaredKind && !Enum.IsDefined(declaredKind))
        {
            throw AppException.Validation("metadata.kind is not a defined attachment kind.");
        }

        var inspection = await db.Inspections.InScope(actor)
            .Include(i => i.Photos)
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == inspectionId, ct)
            ?? throw AppException.NotFound($"Inspection {inspectionId} was not found in your scope.");

        // Author-only. A supervisor who disagrees with an inspection issues a correction; they never
        // take over the pending evidence of somebody else's record.
        if (inspection.CreatedByUserId != actor.Id)
        {
            throw AppException.Forbidden("Only the author of an inspection can upload its photos.");
        }

        var contentType = Normalize(metadata?.ContentType ?? transportContentType);
        var bytes = await ReadLimitedAsync(content, ct);
        var checksum = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        VerifyDeclaredChecksum(metadata, checksum, bytes.Length);

        var inspected = ImageValidation.Inspect(bytes, contentType);
        if (!inspected.Valid)
        {
            throw AppException.Validation($"The uploaded bytes are not a usable {contentType}: {inspected.Error}");
        }

        var existing = inspection.Photos.FirstOrDefault(p => p.Id == photoId);
        if (existing is { Uploaded: true })
        {
            return VerifyIdenticalRetry(existing, metadata, checksum);
        }

        var kind = metadata?.Kind ?? existing?.Kind ?? PhotoKind.Original;
        VerifySignatureBinding(inspection, photoId, kind);

        if (existing is null)
        {
            if (inspection.State == InspectionState.Finalized)
            {
                throw AppException.Conflict(
                    "This photo was not declared before finalization; the finalized photo list cannot change.");
            }

            existing = new PhotoRecord
            {
                Id = photoId,
                InspectionId = inspection.Id,
                ItemId = ResolveItemId(inspection, metadata?.ItemId, kind),
                Kind = kind,
                CreatedAt = metadata?.CreatedAt ?? clock.UtcNow,
                DeclaredByUserId = actor.Id,
            };

            inspection.Photos.Add(existing);
        }
        else
        {
            VerifyDeclaredAssociation(existing, metadata, kind);
            existing.Kind = kind;

            if (existing.ItemId is null && metadata?.ItemId is not null && inspection.State == InspectionState.Draft)
            {
                existing.ItemId = ResolveItemId(inspection, metadata.ItemId, kind);
            }
        }

        await ValidateAnnotationAsync(inspection, existing, metadata, ct);

        var relativePath = storage.BuildRelativePath(inspection.CompanyId, inspection.Id, photoId);
        var written = await storage.SaveIfAbsentAsync(relativePath, new MemoryStream(bytes, writable: false), ct);
        if (!written)
        {
            // Object already there (a previous attempt whose transaction failed, or a concurrent
            // upload that won the race). Accept only identical bytes.
            await using var stored = storage.OpenRead(relativePath);
            var storedChecksum = Convert.ToHexString(await SHA256.HashDataAsync(stored, ct)).ToLowerInvariant();
            if (!string.Equals(storedChecksum, checksum, StringComparison.Ordinal))
            {
                throw AppException.Conflict(
                    "Different content is already stored for this photo id. Attachments are immutable.");
            }
        }

        var now = clock.UtcNow;
        existing.ContentType = contentType;
        existing.Sha256 = checksum;
        existing.SizeBytes = bytes.Length;
        existing.StoragePath = relativePath;
        existing.Uploaded = true;
        existing.UploadedAt = now;

        db.AuditEntries.Add(Audit.Entry(
            now, actor.Id, inspection.CompanyId, AuditActions.PhotoUploaded, "photo", photoId, inspection.Id,
            $"kind={existing.Kind}; bytes={bytes.Length}; {inspected.Width}x{inspected.Height}; sha256={checksum}"));

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Uploaded is a concurrency token: a simultaneous upload for the same declared photo
            // committed first. Whoever lost must agree with the winner or be refused.
            db.ChangeTracker.Clear();
            var winner = await db.Photos.AsNoTracking().FirstOrDefaultAsync(p => p.Id == photoId, ct)
                ?? throw AppException.Conflict("The photo record changed while this upload was being stored.");

            return VerifyIdenticalRetry(winner, metadata, checksum);
        }

        return existing.ToDto();
    }

    public async Task<(Stream Content, string ContentType, string FileName)> DownloadAsync(
        CurrentUser actor, Guid inspectionId, Guid photoId, CancellationToken ct)
    {
        var photo = await db.Photos.AsNoTracking()
            .Where(p => p.Id == photoId && p.InspectionId == inspectionId)
            .Join(db.Inspections.InScope(actor), p => p.InspectionId, i => i.Id, (p, _) => p)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound($"Photo {photoId} was not found in your scope.");

        if (!photo.Uploaded || string.IsNullOrEmpty(photo.StoragePath) || !storage.Exists(photo.StoragePath))
        {
            throw AppException.NotFound($"Photo {photoId} has no stored content yet.");
        }

        var extension = photo.ContentType?.Contains("png", StringComparison.OrdinalIgnoreCase) == true ? "png" : "jpg";
        return (storage.OpenRead(photo.StoragePath), photo.ContentType ?? "application/octet-stream", $"{photoId:N}.{extension}");
    }

    /// <summary>
    /// A retry of a stored attachment is only a retry if it agrees with what is stored. Identical
    /// bytes with a different claimed relationship are a different assertion, not a repeat.
    /// </summary>
    private static PhotoDto VerifyIdenticalRetry(PhotoRecord stored, PhotoUploadMetadata? metadata, string checksum)
    {
        if (!string.Equals(stored.Sha256, checksum, StringComparison.OrdinalIgnoreCase))
        {
            throw AppException.Conflict(
                "This photo already has different content stored. Attachments are immutable; use a new photo id.");
        }

        VerifyDeclaredAssociation(stored, metadata, metadata?.Kind ?? stored.Kind);
        return stored.ToDto();
    }

    /// <summary>
    /// A declared item photo may still resolve to <see cref="PhotoKind.Annotation"/> at upload time,
    /// because <c>items[].photoIds</c> cannot express that distinction. Everything else is fixed:
    /// a signature can never become an item photo or the reverse, and once bytes exist nothing moves.
    /// </summary>
    private static void VerifyDeclaredAssociation(PhotoRecord stored, PhotoUploadMetadata? metadata, PhotoKind kind)
    {
        if (stored.Kind != kind)
        {
            var refinable = !stored.Uploaded
                            && stored.Kind is PhotoKind.Original or PhotoKind.Annotation
                            && kind is PhotoKind.Original or PhotoKind.Annotation;

            if (!refinable)
            {
                throw AppException.Conflict(
                    $"This photo is recorded as {stored.Kind} and cannot be re-declared as {kind}.");
            }
        }

        if (metadata?.ItemId is { } itemId && stored.ItemId is { } current && itemId != current)
        {
            throw AppException.Conflict(
                "This photo is attached to another checklist item and cannot be rebound.");
        }

        if (metadata?.OriginalPhotoId is { } originalId && stored.OriginalPhotoId is { } storedOriginal
            && originalId != storedOriginal)
        {
            throw AppException.Conflict(
                "This annotation already references another original photo and cannot be rebound.");
        }
    }

    /// <summary>An item photo must point at an item of the inspection's pinned template version.</summary>
    private static Guid? ResolveItemId(Inspection inspection, Guid? itemId, PhotoKind kind)
    {
        if (itemId is null)
        {
            return null;
        }

        if (kind == PhotoKind.Signature)
        {
            throw AppException.Validation("A signature is not attached to a checklist item.");
        }

        if (inspection.Items.All(i => i.ItemId != itemId.Value))
        {
            throw AppException.Validation(
                "metadata.itemId does not match any recorded item of this inspection.");
        }

        return itemId;
    }

    /// <summary>
    /// The signature is the attachment declared in <c>inspection.signaturePhotoId</c> and nothing else:
    /// a signature cannot arrive under an item photo id, and an item photo cannot take the signature id.
    /// </summary>
    private static void VerifySignatureBinding(Inspection inspection, Guid photoId, PhotoKind kind)
    {
        var declaredSignature = inspection.SignaturePhotoId;

        if (kind == PhotoKind.Signature && declaredSignature != photoId)
        {
            throw AppException.Conflict(
                "A signature must be uploaded under the id declared in inspection.signaturePhotoId.");
        }

        if (declaredSignature == photoId && kind != PhotoKind.Signature)
        {
            throw AppException.Conflict("The declared signature id only accepts an attachment of kind Signature.");
        }
    }

    private static string Normalize(string? contentType)
    {
        var value = contentType?.Split(';')[0].Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(value) || !AllowedContentTypes.Contains(value))
        {
            throw AppException.UnsupportedMediaType("Only image/jpeg and image/png attachments are accepted.");
        }

        return value;
    }

    private async Task<byte[]> ReadLimitedAsync(Stream content, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await content.ReadAsync(chunk, ct)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > _maxBytes)
            {
                throw AppException.PayloadTooLarge($"Attachments are limited to {_maxBytes} bytes.");
            }
        }

        if (buffer.Length == 0)
        {
            throw AppException.Validation("The uploaded file is empty.");
        }

        return buffer.ToArray();
    }

    private static void VerifyDeclaredChecksum(PhotoUploadMetadata? metadata, string checksum, int length)
    {
        var declared = metadata?.Sha256?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(declared) || declared.Length != 64 || !declared.All(Uri.IsHexDigit))
        {
            throw AppException.Validation(
                "metadata.sha256 must be the 64 character hexadecimal SHA-256 of the uploaded bytes.");
        }

        if (!string.Equals(declared, checksum, StringComparison.Ordinal))
        {
            throw AppException.Validation(
                "The uploaded bytes do not match metadata.sha256; the transfer was corrupted or the metadata is wrong.");
        }

        if (metadata?.SizeBytes is { } declaredSize && declaredSize != length)
        {
            throw AppException.Validation("metadata.sizeBytes does not match the uploaded content length.");
        }
    }

    private async Task ValidateAnnotationAsync(
        Inspection inspection, PhotoRecord photo, PhotoUploadMetadata? metadata, CancellationToken ct)
    {
        if (photo.Kind != PhotoKind.Annotation)
        {
            return;
        }

        var originalId = metadata?.OriginalPhotoId ?? photo.OriginalPhotoId;
        if (originalId is null)
        {
            throw AppException.Validation("An annotation must reference the original photo it was drawn over.");
        }

        var original = inspection.Photos.FirstOrDefault(p => p.Id == originalId.Value)
            ?? await db.Photos.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == originalId.Value && p.InspectionId == inspection.Id, ct);

        if (original is null || original.Kind != PhotoKind.Original)
        {
            throw AppException.Validation(
                "originalPhotoId must reference an existing original photo of the same inspection.");
        }

        photo.OriginalPhotoId = originalId;
    }
}
