// Purpose: proves that parish photos lose their metadata and keep their image data and orientation (QA bug 2, owner decision 23 November 2026).
// Main tests: a phone JPEG (JFIF, EXIF with GPS and orientation 6, XMP, IPTC, a comment, a progressive scan with stuffed and restart bytes,
// an appended second picture) keeps only image segments plus an orientation-only EXIF; little-endian EXIF; no orientation means no EXIF;
// PNG text/EXIF/time chunks and WebP EXIF/XMP chunks are dropped with VP8X flags cleared; broken files are refused.

using System.Buffers.Binary;
using System.Text;
using ParishLife.Api.Services.Publishing;
using Xunit;

namespace ParishLife.UnitTests;

public sealed class PhotoMetadataTests
{
    private static byte[] Segment(byte marker, byte[] body) => [0xFF, marker, (byte)((body.Length + 2) >> 8), (byte)(body.Length + 2), .. body];

    private static byte[] Ascii(string text) => Encoding.ASCII.GetBytes(text);

    // EXIF TIFF data with the orientation and a GPS IFD pointer, as a phone camera writes it.
    private static byte[] Exif(ushort orientation, bool little = false)
    {
        byte[] tiff = little
            ? [(byte)'I', (byte)'I', 0x2A, 0x00, 0x08, 0, 0, 0, 0x02, 0x00,
               0x12, 0x01, 0x03, 0x00, 0x01, 0, 0, 0, (byte)orientation, 0, 0, 0,
               0x25, 0x88, 0x04, 0x00, 0x01, 0, 0, 0, 0x26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            : [(byte)'M', (byte)'M', 0x00, 0x2A, 0, 0, 0, 0x08, 0x00, 0x02,
               0x01, 0x12, 0x00, 0x03, 0, 0, 0, 0x01, 0, (byte)orientation, 0, 0,
               0x88, 0x25, 0x00, 0x04, 0, 0, 0, 0x01, 0, 0, 0, 0x26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        return [.. Ascii("Exif\0\0"), .. tiff];
    }

    private static readonly byte[] Jfif = Segment(0xE0, [.. Ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    private static readonly byte[] Tables = Segment(0xDB, [0, .. Enumerable.Repeat((byte)1, 64)]);
    private static readonly byte[] Frame = Segment(0xC2, [8, 0, 2, 0, 4, 1, 1, 0x11, 0]);
    private static readonly byte[] Scan1 = [.. Segment(0xDA, [1, 1, 0, 0, 0x3F, 0]), 0x12, 0xFF, 0x00, 0x34, 0xFF, 0xD0, 0x56];
    private static readonly byte[] Scan2 = [.. Segment(0xDA, [1, 1, 0, 1, 0x3F, 0]), 0x78, 0x9A];

    private static byte[] PhoneJpeg(byte[] exif) =>
    [
        0xFF, 0xD8, .. Jfif, .. Segment(0xE1, exif), .. Segment(0xE1, Ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta GPSLatitude/>")),
        .. Segment(0xED, Ascii("Photoshop 3.0\0 8BIM IPTC byline")), .. Segment(0xFE, Ascii("taken at home")),
        .. Tables, .. Frame, .. Scan1, .. Segment(0xFE, Ascii("between scans")), .. Scan2, 0xFF, 0xD9,
        0xFF, 0xD8, .. Segment(0xE1, exif), 0xFF, 0xD9 // a second picture appended after the first image's end
    ];

    [Fact]
    public void A_phone_jpeg_keeps_its_image_and_orientation_and_loses_location_text_and_extra_pictures()
    {
        var clean = PhotoMetadata.Strip(PhoneJpeg(Exif(6)), "image/jpeg");

        Assert.Equal([0xFF, 0xD8, .. Jfif, .. PhotoMetadata.OrientationOnly(6), .. Tables, .. Frame, .. Scan1, .. Scan2, 0xFF, 0xD9], clean);
        Assert.Equal((ushort)6, PhotoMetadata.ExifOrientation(PhotoMetadata.OrientationOnly(6).AsSpan(10)));
        var text = Encoding.ASCII.GetString(clean!);
        Assert.DoesNotContain("xmpmeta", text, StringComparison.Ordinal);
        Assert.DoesNotContain("IPTC", text, StringComparison.Ordinal);
        Assert.DoesNotContain("taken at home", text, StringComparison.Ordinal);
        Assert.Equal(-1, clean.AsSpan().IndexOf([(byte)0x88, (byte)0x25])); // no GPS IFD pointer
    }

    [Fact]
    public void Little_endian_exif_is_read_and_an_upright_photo_keeps_no_exif_at_all()
    {
        Assert.Equal((ushort)8, PhotoMetadata.ExifOrientation(Exif(8, little: true).AsSpan(6)));
        var upright = PhotoMetadata.Strip(PhoneJpeg(Exif(1)), "image/jpeg")!;
        Assert.DoesNotContain("Exif", Encoding.ASCII.GetString(upright), StringComparison.Ordinal);
        Assert.Equal([0xFF, 0xD8, .. Jfif, .. Tables, .. Frame, .. Scan1, .. Scan2, 0xFF, 0xD9], upright);
    }

    [Fact]
    public void Broken_jpegs_are_refused()
    {
        Assert.Null(PhotoMetadata.Strip([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x40, 1, 2], "image/jpeg")); // a segment longer than the file
        Assert.Null(PhotoMetadata.Strip([0xFF, 0xD8, .. Tables, .. Frame, .. Scan1], "image/jpeg")); // no end of image
        Assert.Null(PhotoMetadata.Strip([0xFF, 0xD8, 0x12, 0x34], "image/jpeg")); // not a marker
    }

    private static byte[] Chunk(string type, byte[] data)
    {
        var length = new byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(length, (uint)data.Length);
        return [.. length, .. Ascii(type), .. data, 0xAA, 0xBB, 0xCC, 0xDD]; // the CRC is copied, never checked or rewritten
    }

    [Fact]
    public void Png_loses_exif_text_and_time_and_keeps_every_other_chunk()
    {
        byte[] signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        var header = Chunk("IHDR", new byte[13]);
        var colour = Chunk("sRGB", [0]);
        var data = Chunk("IDAT", [1, 2, 3]);
        var end = Chunk("IEND", []);
        byte[] png = [.. signature, .. header, .. Chunk("eXIf", [1, 2]), .. colour, .. Chunk("tEXt", Ascii("GPS\0Beirut")), .. Chunk("zTXt", [9]),
            .. Chunk("iTXt", [9]), .. Chunk("tIME", [7]), .. data, .. end, .. Ascii("trailing")];

        Assert.Equal([.. signature, .. header, .. colour, .. data, .. end], PhotoMetadata.Strip(png, "image/png")!);
        Assert.Null(PhotoMetadata.Strip([.. signature, .. header], "image/png")); // no IEND
    }

    [Fact]
    public void Webp_loses_exif_and_xmp_and_their_flags()
    {
        byte[] Riff(params byte[][] chunks)
        {
            byte[] body = [.. Ascii("WEBP"), .. chunks.SelectMany(c => c)];
            var size = new byte[4];
            BinaryPrimitives.WriteUInt32LittleEndian(size, (uint)body.Length);
            return [.. Ascii("RIFF"), .. size, .. body];
        }
        byte[] RiffChunk(string fourcc, byte[] data)
        {
            var size = new byte[4];
            BinaryPrimitives.WriteUInt32LittleEndian(size, (uint)data.Length);
            return [.. Ascii(fourcc), .. size, .. data, .. (data.Length % 2 == 1 ? new byte[] { 0 } : [])];
        }
        var image = RiffChunk("VP8L", [1, 2, 3]);
        var webp = Riff(RiffChunk("VP8X", [0x1C, 0, 0, 0, 0, 0, 0, 0, 0, 0]), image, RiffChunk("EXIF", [1, 2, 3, 4]), RiffChunk("XMP ", [5]));

        Assert.Equal(Riff(RiffChunk("VP8X", [0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0]), image), PhotoMetadata.Strip(webp, "image/webp")!);
    }
}
