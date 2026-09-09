using System.Buffers.Binary;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;

namespace Susumu.Api.Tests.Infrastructure;

/// <summary>
/// Builds real, structurally complete PNG and JPEG payloads for the upload tests. The API validates
/// container structure, not just magic bytes, so fixtures have to be genuine files; the seed only
/// changes the pixel/comment content so each fixture has a distinct checksum.
/// </summary>
public static class TestImages
{
    public static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    /// <summary>
    /// Emits one PNG chunk with a correct length and CRC, or with a deliberately wrong CRC. Exposed
    /// so the malformed fixtures in the validator tests are assembled from the same code path as the
    /// valid ones, and differ only in the single property under test.
    /// </summary>
    public static byte[] PngChunk(string type, byte[] data, bool corruptCrc = false)
    {
        var chunk = new MemoryStream();
        WriteChunk(chunk, type, data);
        var bytes = chunk.ToArray();

        if (corruptCrc)
        {
            bytes[^1] ^= 0xFF;
        }

        return bytes;
    }

    /// <summary>IHDR payload with every parameter addressable, so invalid combinations can be built.</summary>
    public static byte[] PngHeaderData(
        int width = 4,
        int height = 4,
        byte bitDepth = 8,
        byte colourType = 2,
        byte compression = 0,
        byte filter = 0,
        byte interlace = 0)
    {
        var header = new byte[13];
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(0, 4), (uint)width);
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(4, 4), (uint)height);
        header[8] = bitDepth;
        header[9] = colourType;
        header[10] = compression;
        header[11] = filter;
        header[12] = interlace;
        return header;
    }

    /// <summary>A real deflate stream of plausible raw scanlines, for building valid IDAT chunks.</summary>
    public static byte[] PngImageData(string seed = "data", int width = 4, int height = 4)
        => Deflate(BuildRawPixels(seed, width, height));

    public static (byte[] Bytes, string Sha) Png(string seed, int width = 4, int height = 4)
    {
        var raw = BuildRawPixels(seed, width, height);
        var image = new MemoryStream();

        image.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

        var header = new byte[13];
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(0, 4), (uint)width);
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(4, 4), (uint)height);
        header[8] = 8;  // bit depth
        header[9] = 2;  // colour type: truecolour
        WriteChunk(image, "IHDR", header);

        WriteChunk(image, "IDAT", Deflate(raw));
        WriteChunk(image, "IEND", []);

        var bytes = image.ToArray();
        return (bytes, Sha(bytes));
    }

    public static (byte[] Bytes, string Sha) Jpeg(string seed, int width = 4, int height = 4)
    {
        var image = new MemoryStream();

        image.Write([0xFF, 0xD8]); // SOI

        // COM segment carries the seed so each fixture differs.
        var comment = Encoding.ASCII.GetBytes(seed);
        image.Write([0xFF, 0xFE]);
        WriteSegmentLength(image, comment.Length);
        image.Write(comment);

        // SOF0: precision, height, width, one component.
        var frame = new byte[]
        {
            8,
            (byte)(height >> 8), (byte)(height & 0xFF),
            (byte)(width >> 8), (byte)(width & 0xFF),
            1, 1, 0x11, 0,
        };
        image.Write([0xFF, 0xC0]);
        WriteSegmentLength(image, frame.Length);
        image.Write(frame);

        // SOS followed by a short entropy-coded body and EOI.
        var scan = new byte[] { 1, 1, 0x00, 0, 63, 0 };
        image.Write([0xFF, 0xDA]);
        WriteSegmentLength(image, scan.Length);
        image.Write(scan);
        image.Write([0x00, 0x11, 0x22, 0x33]);
        image.Write([0xFF, 0xD9]); // EOI

        var bytes = image.ToArray();
        return (bytes, Sha(bytes));
    }

    /// <summary>A valid PNG header whose data stops early: used to prove truncation is rejected.</summary>
    public static (byte[] Bytes, string Sha) TruncatedPng(string seed)
    {
        var (complete, _) = Png(seed);
        var truncated = complete[..(complete.Length - 12)];
        return (truncated, Sha(truncated));
    }

    /// <summary>
    /// Structurally valid PNG whose IHDR declares a canvas far beyond any camera, with a token
    /// payload. This is the shape of a decompression bomb: tiny on the wire, enormous once decoded.
    /// </summary>
    public static (byte[] Bytes, string Sha) OversizedPng()
    {
        var image = new MemoryStream();
        image.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

        var header = new byte[13];
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(0, 4), 60_000);
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(4, 4), 60_000);
        header[8] = 8;
        header[9] = 2;
        WriteChunk(image, "IHDR", header);
        WriteChunk(image, "IDAT", Deflate([0, 0, 0, 0]));
        WriteChunk(image, "IEND", []);

        var bytes = image.ToArray();
        return (bytes, Sha(bytes));
    }

    public static string Sha(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    private static byte[] BuildRawPixels(string seed, int width, int height)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(seed));
        var raw = new byte[height * (1 + (width * 3))];
        var index = 0;

        for (var y = 0; y < height; y++)
        {
            raw[index++] = 0; // filter type: none
            for (var x = 0; x < width * 3; x++)
            {
                raw[index++] = hash[(x + y) % hash.Length];
            }
        }

        return raw;
    }

    private static byte[] Deflate(byte[] raw)
    {
        var output = new MemoryStream();
        using (var zlib = new ZLibStream(output, CompressionLevel.Fastest, leaveOpen: true))
        {
            zlib.Write(raw);
        }

        return output.ToArray();
    }

    private static void WriteChunk(Stream target, string type, byte[] data)
    {
        Span<byte> length = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(length, (uint)data.Length);
        target.Write(length);

        var typeBytes = Encoding.ASCII.GetBytes(type);
        target.Write(typeBytes);
        target.Write(data);

        var crc = Crc32(typeBytes, data);
        Span<byte> crcBytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crcBytes, crc);
        target.Write(crcBytes);
    }

    private static void WriteSegmentLength(Stream target, int payloadLength)
    {
        var length = payloadLength + 2;
        target.WriteByte((byte)(length >> 8));
        target.WriteByte((byte)(length & 0xFF));
    }

    private static uint Crc32(byte[] type, byte[] data)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in type.Concat(data))
        {
            crc ^= b;
            for (var i = 0; i < 8; i++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
            }
        }

        return crc ^ 0xFFFFFFFFu;
    }
}
