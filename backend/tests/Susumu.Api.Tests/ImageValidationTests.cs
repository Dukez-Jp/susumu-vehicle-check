using Susumu.Api.Tests.Infrastructure;
using Susumu.Infrastructure.Storage;

namespace Susumu.Api.Tests;

/// <summary>
/// Structural regressions for <see cref="ImageValidation"/>.
///
/// The rule these pin down: an attachment is only acknowledged as delivered evidence when the bytes
/// are a structurally complete image of the declared format. A header with no image data, a chunk
/// whose CRC does not match, or a JPEG that never reaches a scan are all incomplete shells, and an
/// inspection must not be able to report them as uploaded.
///
/// Every malformed fixture is built from the same code path as the valid one and differs only in the
/// single property under test, so a failure names a real rule rather than an accident of assembly.
/// </summary>
public sealed class ImageValidationTests
{
    // ------------------------------------------------------------- valid fixtures

    [Fact]
    public void The_shared_png_fixture_is_structurally_valid()
    {
        var (bytes, _) = TestImages.Png("fixture-check");

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.True(inspected.Valid, inspected.Error);
        Assert.Equal(4, inspected.Width);
        Assert.Equal(4, inspected.Height);
    }

    [Fact]
    public void The_shared_jpeg_fixture_is_structurally_valid()
    {
        var (bytes, _) = TestImages.Jpeg("fixture-check");

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.True(inspected.Valid, inspected.Error);
        Assert.Equal(4, inspected.Width);
        Assert.Equal(4, inspected.Height);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(64, 48)]
    [InlineData(4000, 3000)]
    public void Realistic_photo_dimensions_are_accepted(int width, int height)
    {
        var (png, _) = TestImages.Png("dimensions", width, height);
        var (jpeg, _) = TestImages.Jpeg("dimensions", width, height);

        Assert.True(ImageValidation.Inspect(png, "image/png").Valid);
        Assert.True(ImageValidation.Inspect(jpeg, "image/jpeg").Valid);
    }

    [Fact]
    public void A_png_with_several_consecutive_data_chunks_is_accepted()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IDAT", TestImages.PngImageData("part-one")),
            TestImages.PngChunk("IDAT", TestImages.PngImageData("part-two")),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.True(inspected.Valid, inspected.Error);
    }

    [Fact]
    public void An_indexed_colour_png_with_its_palette_is_accepted()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData(colourType: 3, bitDepth: 8)),
            TestImages.PngChunk("PLTE", [0xFF, 0x00, 0x00, 0x00, 0xFF, 0x00]),
            TestImages.PngChunk("IDAT", TestImages.PngImageData()),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.True(inspected.Valid, inspected.Error);
    }

    // ------------------------------------------------------------- PNG negatives

    [Fact]
    public void A_png_header_and_terminator_with_no_image_data_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("no image data", inspected.Error);
    }

    [Fact]
    public void A_png_whose_data_chunk_is_empty_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IDAT", []),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("no image data", inspected.Error);
    }

    [Fact]
    public void A_png_chunk_with_a_wrong_crc_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IDAT", TestImages.PngImageData(), corruptCrc: true),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("CRC", inspected.Error);
        Assert.Contains("IDAT", inspected.Error);
    }

    [Fact]
    public void A_png_whose_header_crc_is_wrong_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData(), corruptCrc: true),
            TestImages.PngChunk("IDAT", TestImages.PngImageData()),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("CRC", inspected.Error);
    }

    [Fact]
    public void A_png_terminator_carrying_a_payload_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IDAT", TestImages.PngImageData()),
            TestImages.PngChunk("IEND", [0x00, 0x01, 0x02, 0x03]));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("non-zero length", inspected.Error);
    }

    [Theory]
    [InlineData(3, 16, "colour type")]   // indexed colour has no 16-bit depth
    [InlineData(2, 4, "colour type")]    // truecolour has no 4-bit depth
    [InlineData(2, 0, "colour type")]    // zero bit depth does not exist
    [InlineData(7, 8, "colour type")]    // colour type 7 is not defined
    public void A_png_header_with_an_invalid_colour_type_or_bit_depth_is_refused(
        byte colourType, byte bitDepth, string expected)
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData(colourType: colourType, bitDepth: bitDepth)),
            TestImages.PngChunk("IDAT", TestImages.PngImageData()),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains(expected, inspected.Error);
    }

    [Theory]
    [InlineData(1, 0, 0, "compression")]
    [InlineData(0, 1, 0, "filter")]
    [InlineData(0, 0, 2, "interlace")]
    public void A_png_header_declaring_unknown_methods_is_refused(
        byte compression, byte filter, byte interlace, string expected)
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData(
                compression: compression, filter: filter, interlace: interlace)),
            TestImages.PngChunk("IDAT", TestImages.PngImageData()),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains(expected, inspected.Error);
    }

    [Fact]
    public void A_png_that_does_not_start_with_its_header_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IDAT", TestImages.PngImageData()),
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("first PNG chunk", inspected.Error);
    }

    [Fact]
    public void A_png_with_two_headers_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IDAT", TestImages.PngImageData()),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("more than one image header", inspected.Error);
    }

    [Fact]
    public void A_png_whose_data_chunks_are_not_consecutive_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData()),
            TestImages.PngChunk("IDAT", TestImages.PngImageData("first")),
            TestImages.PngChunk("tEXt", "note"u8.ToArray()),
            TestImages.PngChunk("IDAT", TestImages.PngImageData("second")),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("not consecutive", inspected.Error);
    }

    [Fact]
    public void An_indexed_colour_png_without_a_palette_is_refused()
    {
        var bytes = Png(
            TestImages.PngChunk("IHDR", TestImages.PngHeaderData(colourType: 3, bitDepth: 8)),
            TestImages.PngChunk("IDAT", TestImages.PngImageData()),
            TestImages.PngChunk("IEND", []));

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("no palette", inspected.Error);
    }

    [Fact]
    public void A_png_with_data_appended_after_its_terminator_is_refused()
    {
        var (valid, _) = TestImages.Png("trailing");
        var bytes = valid.Concat("appended"u8.ToArray()).ToArray();

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("trailing data", inspected.Error);
    }

    [Fact]
    public void A_truncated_png_is_refused()
    {
        var (bytes, _) = TestImages.TruncatedPng("cut-short");

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("truncated", inspected.Error);
    }

    [Fact]
    public void A_png_declaring_an_unreasonable_canvas_is_refused()
    {
        var (bytes, _) = TestImages.OversizedPng();

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
        Assert.Contains("pixels", inspected.Error);
    }

    [Fact]
    public void Bytes_that_merely_start_with_the_png_signature_are_refused()
    {
        var bytes = TestImages.PngSignature.ToArray()
            .Concat(System.Text.Encoding.UTF8.GetBytes(new string('x', 128)))
            .ToArray();

        var inspected = ImageValidation.Inspect(bytes, "image/png");

        Assert.False(inspected.Valid);
    }

    // ------------------------------------------------------------ JPEG negatives

    [Fact]
    public void A_jpeg_header_only_shell_with_no_scan_is_refused()
    {
        var bytes = Jpeg(Soi, Frame(4, 4), Eoi);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("no scan", inspected.Error);
    }

    [Fact]
    public void A_jpeg_with_only_a_soi_and_eoi_is_refused()
    {
        var bytes = Jpeg(Soi, Eoi);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("no scan", inspected.Error);
    }

    [Fact]
    public void A_jpeg_whose_scan_starts_before_any_frame_is_refused()
    {
        var bytes = Jpeg(Soi, ScanHeader(), [0x00, 0x11], Eoi);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("before any frame header", inspected.Error);
    }

    [Fact]
    public void A_jpeg_scan_that_is_not_terminated_by_eoi_is_refused()
    {
        var bytes = Jpeg(Soi, Frame(4, 4), ScanHeader(), [0x00, 0x11, 0x22, 0x33]);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("truncated", inspected.Error);
    }

    [Fact]
    public void A_jpeg_with_an_empty_scan_is_refused()
    {
        var bytes = Jpeg(Soi, Frame(4, 4), ScanHeader(), Eoi);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("no image data", inspected.Error);
    }

    [Fact]
    public void A_jpeg_declaring_two_frames_is_refused()
    {
        var bytes = Jpeg(Soi, Frame(4, 4), Frame(8, 8), ScanHeader(), [0x00, 0x11], Eoi);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("more than one frame header", inspected.Error);
    }

    [Fact]
    public void A_jpeg_frame_declaring_no_components_is_refused()
    {
        var bytes = Jpeg(Soi, Frame(4, 4, components: 0), ScanHeader(), [0x00, 0x11], Eoi);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("no components", inspected.Error);
    }

    [Fact]
    public void A_jpeg_segment_declaring_a_length_past_the_end_is_refused()
    {
        var bytes = Jpeg(Soi, [0xFF, 0xFE, 0x7F, 0xFF], Eoi);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("beyond the end", inspected.Error);
    }

    [Fact]
    public void A_jpeg_declaring_an_unreasonable_canvas_is_refused()
    {
        var bytes = Jpeg(Soi, Frame(60_000, 60_000), ScanHeader(), [0x00, 0x11], Eoi);

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
        Assert.Contains("pixels", inspected.Error);
    }

    [Fact]
    public void Bytes_that_merely_start_with_the_jpeg_magic_are_refused()
    {
        var bytes = new byte[] { 0xFF, 0xD8, 0xFF }
            .Concat(System.Text.Encoding.UTF8.GetBytes(new string('x', 128)))
            .ToArray();

        var inspected = ImageValidation.Inspect(bytes, "image/jpeg");

        Assert.False(inspected.Valid);
    }

    // ------------------------------------------------------------------- shared

    [Fact]
    public void A_content_type_the_api_does_not_accept_is_refused()
    {
        var (bytes, _) = TestImages.Png("gif-claim");

        var inspected = ImageValidation.Inspect(bytes, "image/gif");

        Assert.False(inspected.Valid);
        Assert.Contains("Unsupported content type", inspected.Error);
    }

    [Fact]
    public void A_png_presented_as_a_jpeg_is_refused_and_the_reverse()
    {
        var (png, _) = TestImages.Png("swapped");
        var (jpeg, _) = TestImages.Jpeg("swapped");

        Assert.False(ImageValidation.Inspect(png, "image/jpeg").Valid);
        Assert.False(ImageValidation.Inspect(jpeg, "image/png").Valid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(8)]
    [InlineData(20)]
    public void A_payload_shorter_than_any_container_is_refused_without_throwing(int length)
    {
        var bytes = new byte[length];

        Assert.False(ImageValidation.Inspect(bytes, "image/png").Valid);
        Assert.False(ImageValidation.Inspect(bytes, "image/jpeg").Valid);
    }

    /// <summary>
    /// Every single-byte corruption of a valid file must be either refused or still structurally
    /// valid, and must never throw. This is the cheap way to show the walk stays inside the buffer
    /// on hostile input rather than relying on the handful of malformations above.
    /// </summary>
    [Fact]
    public void No_single_byte_corruption_of_a_valid_image_can_make_the_parser_throw()
    {
        var (png, _) = TestImages.Png("fuzz");
        var (jpeg, _) = TestImages.Jpeg("fuzz");

        foreach (var (original, contentType) in new[] { (png, "image/png"), (jpeg, "image/jpeg") })
        {
            for (var index = 0; index < original.Length; index++)
            {
                foreach (var mask in new byte[] { 0xFF, 0x01, 0x80 })
                {
                    var mutated = original.ToArray();
                    mutated[index] ^= mask;

                    var inspected = Record.Exception(() => ImageValidation.Inspect(mutated, contentType));
                    Assert.Null(inspected);
                }
            }
        }
    }

    [Fact]
    public void Truncating_a_valid_image_at_any_point_is_refused_and_never_throws()
    {
        var (png, _) = TestImages.Png("truncation-sweep");
        var (jpeg, _) = TestImages.Jpeg("truncation-sweep");

        foreach (var (original, contentType) in new[] { (png, "image/png"), (jpeg, "image/jpeg") })
        {
            for (var length = 0; length < original.Length; length++)
            {
                var truncated = original.AsSpan(0, length).ToArray();

                var inspected = ImageValidation.Inspect(truncated, contentType);
                Assert.False(inspected.Valid, $"A {contentType} truncated to {length} bytes was accepted.");
            }

            Assert.True(ImageValidation.Inspect(original, contentType).Valid);
        }
    }

    // --------------------------------------------------------------- assemblers

    private static byte[] Png(params byte[][] chunks)
        => TestImages.PngSignature.ToArray().Concat(chunks.SelectMany(c => c)).ToArray();

    private static byte[] Jpeg(params byte[][] parts) => parts.SelectMany(p => p).ToArray();

    private static byte[] Soi => [0xFF, 0xD8];

    private static byte[] Eoi => [0xFF, 0xD9];

    private static byte[] Frame(int width, int height, byte components = 1)
    {
        var payload = new byte[]
        {
            8,
            (byte)(height >> 8), (byte)(height & 0xFF),
            (byte)(width >> 8), (byte)(width & 0xFF),
            components, 1, 0x11, 0,
        };

        return Segment(0xC0, payload);
    }

    private static byte[] ScanHeader() => Segment(0xDA, [1, 1, 0x00, 0, 63, 0]);

    private static byte[] Segment(byte marker, byte[] payload)
    {
        var length = payload.Length + 2;
        return new byte[] { 0xFF, marker, (byte)(length >> 8), (byte)(length & 0xFF) }
            .Concat(payload)
            .ToArray();
    }
}
