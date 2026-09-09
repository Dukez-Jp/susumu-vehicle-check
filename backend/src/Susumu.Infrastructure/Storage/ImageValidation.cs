namespace Susumu.Infrastructure.Storage;

public sealed record ImageInspection(bool Valid, string? Error, int Width, int Height);

/// <summary>
/// Structural validation for the two accepted formats.
///
/// Magic bytes alone prove nothing: a truncated file, a header-only shell, a decompression bomb or
/// an arbitrary payload with a valid prefix all pass that check. This walks the container structure
/// instead — every PNG chunk (header, declared length and CRC) and every JPEG marker segment — and
/// refuses anything whose declared lengths do not add up, that carries no image data at all, that
/// has no proper terminator, or whose pixel count is unreasonable for a workshop photo.
///
/// Deliberately a parser of container structure only, never a decoder: no compressed stream is
/// inflated and no pixel is reconstructed, so validating a hostile file costs time and memory
/// bounded by the file length, and no third-party imaging licence is introduced.
///
/// What this therefore does <b>not</b> claim, and must not be described as:
/// it is not a full decode, it does not prove the compressed data would inflate to a coherent
/// image, it does not verify JPEG entropy-coded content, and it is not a malware scanner.
/// It establishes that the bytes are a structurally complete image of the declared format, of a
/// plausible size — which is what "this attachment is usable evidence" requires.
/// </summary>
public static class ImageValidation
{
    /// <summary>Well beyond any tablet camera; a larger canvas is a decompression bomb, not a photo.</summary>
    public const int MaxDimension = 20_000;

    public const long MaxPixels = 80_000_000;

    /// <summary>A scan with fewer entropy-coded bytes than this carries no image content.</summary>
    public const int MinJpegScanBytes = 2;

    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    public static ImageInspection Inspect(ReadOnlySpan<byte> bytes, string contentType) => contentType switch
    {
        "image/png" => InspectPng(bytes),
        "image/jpeg" => InspectJpeg(bytes),
        _ => new ImageInspection(false, $"Unsupported content type '{contentType}'.", 0, 0),
    };

    // ---------------------------------------------------------------- PNG

    private static ImageInspection InspectPng(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < PngSignature.Length + 12 || !bytes[..PngSignature.Length].SequenceEqual(PngSignature))
        {
            return Invalid("The payload does not start with a PNG signature.");
        }

        var offset = PngSignature.Length;
        var width = 0;
        var height = 0;
        var colourType = -1;
        var sawHeader = false;
        var sawPalette = false;
        var sawEnd = false;
        var idatBytes = 0L;
        var idatChunks = 0;
        var idatClosed = false;

        while (offset + 8 <= bytes.Length)
        {
            var length = ReadUInt32BigEndian(bytes, offset);
            if (length > int.MaxValue - 12)
            {
                return Invalid("A PNG chunk declares an impossible length.");
            }

            var typeSpan = bytes.Slice(offset + 4, 4);
            if (!IsChunkType(typeSpan))
            {
                return Invalid("A PNG chunk type is not four ASCII letters.");
            }

            var type = System.Text.Encoding.ASCII.GetString(typeSpan);
            var dataStart = offset + 8;
            var crcStart = dataStart + (int)length;
            var chunkEnd = (long)crcStart + 4;

            if (chunkEnd > bytes.Length)
            {
                return Invalid("The PNG data ends inside a chunk; the file is truncated.");
            }

            // The CRC covers the type and the data. A mismatch means the bytes were altered or the
            // file was assembled by something that is not producing real PNGs.
            var declaredCrc = ReadUInt32BigEndian(bytes, crcStart);
            var actualCrc = Crc32(bytes.Slice(offset + 4, 4 + (int)length));
            if (declaredCrc != actualCrc)
            {
                return Invalid($"The CRC of PNG chunk '{type}' does not match its contents.");
            }

            if (!sawHeader)
            {
                if (type != "IHDR" || length != 13)
                {
                    return Invalid("The first PNG chunk is not a valid IHDR.");
                }

                var header = InspectPngHeader(bytes.Slice(dataStart, 13), out width, out height, out colourType);
                if (header is not null)
                {
                    return Invalid(header);
                }

                sawHeader = true;
                offset = (int)chunkEnd;
                continue;
            }

            switch (type)
            {
                case "IHDR":
                    return Invalid("The PNG declares more than one image header.");

                case "PLTE":
                    if (idatChunks > 0)
                    {
                        return Invalid("The PNG palette appears after the image data.");
                    }

                    sawPalette = true;
                    break;

                case "IDAT":
                    if (idatClosed)
                    {
                        return Invalid("The PNG image data chunks are not consecutive.");
                    }

                    idatChunks++;
                    idatBytes += length;
                    break;

                case "IEND":
                    if (length != 0)
                    {
                        return Invalid("The PNG end marker declares a non-zero length.");
                    }

                    sawEnd = true;
                    break;

                default:
                    break;
            }

            if (idatChunks > 0 && type != "IDAT")
            {
                idatClosed = true;
            }

            offset = (int)chunkEnd;

            if (sawEnd)
            {
                break;
            }
        }

        if (!sawHeader)
        {
            return Invalid("The PNG has no image header.");
        }

        if (!sawEnd)
        {
            return Invalid("The PNG has no IEND chunk; the file is truncated.");
        }

        if (offset != bytes.Length)
        {
            return Invalid("The PNG has trailing data after IEND.");
        }

        // A header and a terminator with nothing between them is not an image, and accepting one
        // would record an empty attachment as delivered evidence.
        if (idatChunks == 0 || idatBytes == 0)
        {
            return Invalid("The PNG contains no image data.");
        }

        // Indexed-colour images are meaningless without their palette.
        if (colourType == 3 && !sawPalette)
        {
            return Invalid("The indexed-colour PNG has no palette.");
        }

        return CheckDimensions(width, height);
    }

    /// <summary>
    /// Validates the IHDR parameters themselves. Only the bit depth and colour type combinations the
    /// PNG specification defines are accepted, and the compression, filter and interlace methods must
    /// be the ones the format actually has.
    /// </summary>
    private static string? InspectPngHeader(
        ReadOnlySpan<byte> header, out int width, out int height, out int colourType)
    {
        width = (int)ReadUInt32BigEndian(header, 0);
        height = (int)ReadUInt32BigEndian(header, 4);
        var bitDepth = header[8];
        colourType = header[9];
        var compression = header[10];
        var filter = header[11];
        var interlace = header[12];

        if (width <= 0 || height <= 0)
        {
            return "The PNG header declares a zero or negative dimension.";
        }

        var depthAllowed = colourType switch
        {
            0 => bitDepth is 1 or 2 or 4 or 8 or 16,   // greyscale
            2 => bitDepth is 8 or 16,                   // truecolour
            3 => bitDepth is 1 or 2 or 4 or 8,          // indexed
            4 => bitDepth is 8 or 16,                   // greyscale + alpha
            6 => bitDepth is 8 or 16,                   // truecolour + alpha
            _ => false,
        };

        if (!depthAllowed)
        {
            return $"The PNG header declares an invalid colour type {colourType} / bit depth {bitDepth} combination.";
        }

        if (compression != 0)
        {
            return "The PNG header declares an unknown compression method.";
        }

        if (filter != 0)
        {
            return "The PNG header declares an unknown filter method.";
        }

        if (interlace > 1)
        {
            return "The PNG header declares an unknown interlace method.";
        }

        return null;
    }

    // --------------------------------------------------------------- JPEG

    private static ImageInspection InspectJpeg(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8)
        {
            return Invalid("The payload does not start with a JPEG SOI marker.");
        }

        var offset = 2;
        var width = 0;
        var height = 0;
        var sawFrame = false;

        while (offset + 1 < bytes.Length)
        {
            if (bytes[offset] != 0xFF)
            {
                return Invalid("The JPEG marker structure is corrupt.");
            }

            // Fill bytes between segments are legal.
            while (offset < bytes.Length && bytes[offset] == 0xFF)
            {
                offset++;
            }

            if (offset >= bytes.Length)
            {
                return Invalid("The JPEG data ends inside a marker; the file is truncated.");
            }

            var marker = bytes[offset++];

            if (marker == 0xD9)
            {
                // EOI before any scan: a header-only shell carrying no image content.
                return Invalid("The JPEG ends before its image data; there is no scan.");
            }

            // Standalone markers carry no payload.
            if (marker is 0x01 or >= 0xD0 and <= 0xD7)
            {
                continue;
            }

            if (offset + 2 > bytes.Length)
            {
                return Invalid("The JPEG data ends inside a segment header.");
            }

            var segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
            if (segmentLength < 2 || offset + segmentLength > bytes.Length)
            {
                return Invalid("A JPEG segment declares a length beyond the end of the file.");
            }

            // SOF0..SOF15 except the non-frame markers DHT (C4), JPG (C8) and DAC (CC).
            if (marker is >= 0xC0 and <= 0xCF && marker is not (0xC4 or 0xC8 or 0xCC))
            {
                if (sawFrame)
                {
                    return Invalid("The JPEG declares more than one frame header.");
                }

                if (segmentLength < 8)
                {
                    return Invalid("The JPEG frame header is too short.");
                }

                height = (bytes[offset + 3] << 8) | bytes[offset + 4];
                width = (bytes[offset + 5] << 8) | bytes[offset + 6];

                if (bytes[offset + 7] == 0)
                {
                    return Invalid("The JPEG frame header declares no components.");
                }

                sawFrame = true;
            }

            offset += segmentLength;

            if (marker == 0xDA)
            {
                if (!sawFrame)
                {
                    return Invalid("The JPEG scan starts before any frame header.");
                }

                // Start of scan: entropy-coded data follows, which is not marker-structured. Rather
                // than walking compressed bytes, require that the file really ends with EOI and that
                // there is entropy-coded content between the scan header and it.
                if (bytes.Length < offset + 2 || bytes[^2] != 0xFF || bytes[^1] != 0xD9)
                {
                    return Invalid("The JPEG scan is not terminated by an EOI marker; the file is truncated.");
                }

                var scanBytes = bytes.Length - 2 - offset;
                if (scanBytes < MinJpegScanBytes)
                {
                    return Invalid("The JPEG scan contains no image data.");
                }

                return CheckDimensions(width, height);
            }
        }

        return Invalid("The JPEG has no end-of-image marker; the file is truncated.");
    }

    // ------------------------------------------------------------- shared

    private static ImageInspection CheckDimensions(int width, int height)
    {
        if (width <= 0 || height <= 0)
        {
            return Invalid("The image declares a zero dimension.");
        }

        if (width > MaxDimension || height > MaxDimension)
        {
            return Invalid($"The image is larger than {MaxDimension} pixels on a side.");
        }

        if ((long)width * height > MaxPixels)
        {
            return Invalid($"The image declares more than {MaxPixels} pixels.");
        }

        return new ImageInspection(true, null, width, height);
    }

    private static ImageInspection Invalid(string error) => new(false, error, 0, 0);

    private static bool IsChunkType(ReadOnlySpan<byte> type)
    {
        foreach (var b in type)
        {
            if (b is not (>= (byte)'A' and <= (byte)'Z' or >= (byte)'a' and <= (byte)'z'))
            {
                return false;
            }
        }

        return true;
    }

    private static uint ReadUInt32BigEndian(ReadOnlySpan<byte> bytes, int offset)
        => ((uint)bytes[offset] << 24) | ((uint)bytes[offset + 1] << 16) |
           ((uint)bytes[offset + 2] << 8) | bytes[offset + 3];

    /// <summary>
    /// Standard PNG CRC-32 (IEEE 802.3 polynomial, reflected), table driven so verifying the chunks
    /// of a maximum-size attachment stays a single cheap pass rather than eight shifts per byte.
    /// </summary>
    private static uint Crc32(ReadOnlySpan<byte> data)
    {
        var crc = 0xFFFFFFFFu;

        foreach (var b in data)
        {
            crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        }

        return crc ^ 0xFFFFFFFFu;
    }

    private static readonly uint[] CrcTable = BuildCrcTable();

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];

        for (var n = 0u; n < 256; n++)
        {
            var c = n;
            for (var k = 0; k < 8; k++)
            {
                c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            }

            table[n] = c;
        }

        return table;
    }
}
