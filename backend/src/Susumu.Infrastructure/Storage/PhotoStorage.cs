using Microsoft.Extensions.Options;

namespace Susumu.Infrastructure.Storage;

public sealed class PhotoStorageOptions
{
    public const string SectionName = "PhotoStorage";

    /// <summary>Filesystem root for attachment bytes. Kept outside PostgreSQL and outside the repository.</summary>
    public string RootPath { get; set; } = string.Empty;

    public long MaxBytes { get; set; } = 15L * 1024 * 1024;
}

public interface IPhotoStorage
{
    bool Exists(string relativePath);

    /// <summary>
    /// Writes bytes once. If the path already exists the existing object is kept untouched and the
    /// method returns false, so an uploaded original can never be replaced by a later request.
    /// </summary>
    Task<bool> SaveIfAbsentAsync(string relativePath, Stream content, CancellationToken ct);

    Stream OpenRead(string relativePath);

    string BuildRelativePath(Guid companyId, Guid inspectionId, Guid photoId);
}

public sealed class FileSystemPhotoStorage(IOptions<PhotoStorageOptions> options) : IPhotoStorage
{
    private readonly string _root = Path.GetFullPath(
        string.IsNullOrWhiteSpace(options.Value.RootPath)
            ? Path.Combine(AppContext.BaseDirectory, "photo-storage")
            : options.Value.RootPath);

    /// <summary>
    /// One object key per photo id, deliberately independent of the content type. An extension in the
    /// key would let two concurrent uploads that disagree about the format write two different files
    /// for the same declared photo; with a single key the "create new file only" write is the
    /// arbiter. Path segments come from identifiers only, never from a client filename.
    /// </summary>
    public string BuildRelativePath(Guid companyId, Guid inspectionId, Guid photoId)
        => $"{companyId:N}/{inspectionId:N}/{photoId:N}.bin";

    public bool Exists(string relativePath) => File.Exists(Resolve(relativePath));

    public async Task<bool> SaveIfAbsentAsync(string relativePath, Stream content, CancellationToken ct)
    {
        var target = Resolve(relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);

        if (File.Exists(target))
        {
            return false;
        }

        var temp = target + ".tmp-" + Guid.NewGuid().ToString("N");
        try
        {
            await using (var file = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await content.CopyToAsync(file, ct);

                // FlushAsync only empties the managed buffer. Flush(true) issues the platform's
                // flush-to-disk, so the bytes survive a power loss before we acknowledge the upload.
                file.Flush(flushToDisk: true);
            }

            // Move is atomic on the same volume, and CreateNew above guarantees the temp file was
            // ours alone; a crash mid-upload leaves a temp file, never a partial or truncated object.
            File.Move(temp, target, overwrite: false);
            return true;
        }
        catch (IOException) when (File.Exists(target))
        {
            return false;
        }
        finally
        {
            if (File.Exists(temp))
            {
                try
                {
                    File.Delete(temp);
                }
                catch (IOException)
                {
                    // Leftover temp files are harmless; never fail an upload because cleanup failed.
                }
            }
        }
    }

    public Stream OpenRead(string relativePath)
        => new FileStream(Resolve(relativePath), FileMode.Open, FileAccess.Read, FileShare.Read);

    private string Resolve(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            throw new ArgumentException("Storage path is required.", nameof(relativePath));
        }

        var full = Path.GetFullPath(Path.Combine(_root, relativePath));
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;

        if (!full.StartsWith(rootWithSeparator, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Resolved storage path escapes the configured root.");
        }

        return full;
    }
}
