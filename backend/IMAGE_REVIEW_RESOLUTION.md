# Image validation — structural completeness

Scope: the two gaps Codex confirmed in `Storage/ImageValidation.cs`. Both were real, and both meant
a structurally incomplete file could be acknowledged as delivered evidence.

Files touched: `src/Susumu.Infrastructure/Storage/ImageValidation.cs`,
`tests/Susumu.Api.Tests/Infrastructure/TestImages.cs` (additive helpers only),
`tests/Susumu.Api.Tests/ImageValidationTests.cs` (new), this file (new). Nothing else.

Evidence: `dotnet test Susumu.slnx --artifacts-path C:/Dev/SusumuVehicleCheck/.local/image-review-build
--filter "FullyQualifiedName~ImageValidationTests"` → **45 passed, 0 failed, 0 skipped**.
No PostgreSQL, no full-suite run, isolated build output.

## The two confirmed gaps

| Gap | Before | Now |
| --- | --- | --- |
| PNG accepted `IHDR` + `IEND` with no `IDAT` | An empty shell validated and was stored as an uploaded photo | `IDAT` is required and its total declared data length must be non-zero |
| PNG did not verify chunk CRCs or the `IEND` length | Any altered or fabricated chunk passed; `IEND` could carry a payload | Every chunk's CRC-32 is verified over type+data; `IEND` must declare length 0 |
| JPEG accepted `SOF` + `EOI` with no scan | A header-only shell validated | Reaching `EOI` before `SOS` is refused; a scan is required |

## Every rule that is now enforced

**PNG**

1. Exact 8-byte signature.
2. Each chunk: declared length is sane, the chunk fits inside the file, and the type is four ASCII
   letters as the specification requires.
3. **CRC-32 over type+data must match the stored CRC** for every chunk, including `IHDR` and `IEND`.
4. The first chunk is `IHDR` with length 13, and there is only one `IHDR`.
5. `IHDR` parameters are validated, not just read: width and height greater than zero; only the
   colour-type/bit-depth combinations the format defines (0:1/2/4/8/16, 2:8/16, 3:1/2/4/8, 4:8/16,
   6:8/16); compression method 0; filter method 0; interlace method 0 or 1.
6. **At least one `IDAT`, with a non-zero total data length.**
7. `IDAT` chunks must be consecutive, and `PLTE` must not follow the image data.
8. Indexed colour (type 3) requires a `PLTE`.
9. `IEND` must declare length 0, and nothing may follow it.

**JPEG**

1. `SOI` present.
2. Marker structure walked segment by segment; a declared segment length may not run past the end.
3. Exactly one frame header (`SOF0`–`SOF15`, excluding `DHT`/`JPG`/`DAC`), at least 8 bytes long and
   declaring at least one component.
4. **A scan (`SOS`) is required**, and it may not appear before the frame header.
5. **`EOI` before any scan is refused** — this is the header-only shell.
6. After `SOS` the file must terminate with `FF D9`, with at least 2 bytes of entropy-coded data
   between the scan header and it, so an empty scan is refused.

**Both**: dimensions must be positive, at most 20 000 per side and at most 80 MP.

## Tests

45 tests in `ImageValidationTests.cs`.

- **Valid fixtures still validate**: the shared `TestImages.Png`/`Jpeg` builders, 1×1 up to
  4000×3000, multi-`IDAT` PNGs, and an indexed-colour PNG with its palette. This is the confirmation
  that `TestImages` output remains genuinely valid under the stricter rules.
- **PNG negatives**: no `IDAT`; empty `IDAT`; wrong CRC on `IDAT`; wrong CRC on `IHDR`; `IEND` with a
  payload; four invalid colour-type/bit-depth pairs; unknown compression/filter/interlace; a file
  that does not start with `IHDR`; two `IHDR`s; non-consecutive `IDAT`s; indexed colour with no
  palette; data appended after `IEND`; truncation; oversized canvas; signature-plus-garbage.
- **JPEG negatives**: header-only shell (`SOF`+`EOI`); bare `SOI`+`EOI`; scan before any frame; scan
  with no terminal `EOI`; empty scan; two frames; frame with zero components; segment length past the
  end; oversized canvas; magic-bytes-plus-garbage.
- **Cross-format**: a PNG presented as JPEG and the reverse; an unsupported content type.
- **Bounds**: payloads of 0, 1, 8 and 20 bytes are refused without throwing.
- **Sweeps**: every single-byte corruption of a valid PNG and JPEG (three bit masks per position) is
  asserted not to throw, and every truncation of a valid file at every length is asserted to be
  refused. These show the walk stays inside the buffer on hostile input rather than relying only on
  the hand-written malformations.

The malformed fixtures are assembled from the same `TestImages.PngChunk`/`PngHeaderData` code path as
the valid ones and differ only in the property under test, so a failure names a real rule rather than
an accident of assembly. `TestImages` gained only additive public helpers; `Png`, `Jpeg`,
`TruncatedPng` and `OversizedPng` are unchanged.

One incidental change: the CRC is table-driven, so verifying every chunk of a maximum-size 15 MiB
attachment stays one cheap pass instead of eight shifts per byte. `TestImages` still computes its
CRCs with the bitwise form, so the two independent implementations agreeing on every valid fixture is
itself a cross-check of the table.

## Honest limits of this parser

Stated so nobody upgrades the claim later. This is container-structure validation, and that is all:

- **It is not a decode.** No zlib stream is inflated and no pixel is reconstructed. A PNG whose
  `IDAT` bytes are well-formed deflate garbage, or whose scanline filters are nonsense, passes.
- **JPEG entropy-coded data is not examined.** The scan is bounded by "starts after `SOS`, ends at a
  terminal `EOI`, is at least 2 bytes"; its Huffman/arithmetic content is not checked, so a JPEG with
  a corrupt scan body passes. Restart markers and multi-scan progressive files are accepted on the
  strength of that terminal `EOI` alone.
- **Declared dimensions are trusted.** The limits catch a decompression bomb that *declares* an
  enormous canvas; they cannot catch one that declares a small canvas and lies.
- **It is not a malware scanner and not a content check.** It says nothing about what the image
  depicts, and an attachment that is a structurally perfect image of the wrong thing is accepted.
- **Ancillary chunks are checked for framing and CRC only**; their payloads are not interpreted, so a
  hostile `iTXt`/`zTXt` payload is passed through to storage untouched (and is never rendered by the
  API, which serves bytes with the stored content type).
- Cost is bounded by the file length, which is itself bounded by the 15 MiB gate that runs first.

What it does establish, which is what the finding asked for: the bytes are a complete, self-consistent
container of the declared format, carrying actual image data, of a plausible size — so an inspection
can no longer report an empty or fabricated shell as delivered evidence.
