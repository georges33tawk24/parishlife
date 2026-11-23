// Purpose: removes the metadata from an uploaded parish photo before it is stored or served (QA bug 2, owner decision 23 November 2026):
// a phone's EXIF block carries the GPS position, the device and the time. Only metadata containers are dropped; the image data is copied
// byte for byte, so nothing is decoded (no native image code reads untrusted files) and no quality is lost. A JPEG whose EXIF says the
// camera was turned keeps one tiny EXIF block holding only that orientation, so the photo still shows upright (browsers apply it).
// Main members: Strip (by detected type; null when the file's structure is broken), Jpeg, Png, Webp, ExifOrientation, OrientationOnly.

using System.Buffers.Binary;
using System.Text;

namespace ParishLife.Api.Services.Publishing;

internal static class PhotoMetadata
{
    internal static byte[]? Strip(byte[] content, string type) => type switch
    {
        "image/jpeg" => Jpeg(content),
        "image/png" => Png(content),
        "image/webp" => Webp(content),
        _ => null
    };

    // Keeps the image segments, the JFIF header (APP0 "JFIF"), the colour profile (APP2 "ICC_PROFILE") and Adobe's colour transform (APP14).
    // Drops every other APPn (EXIF, XMP, IPTC, the multi-picture index, maker notes) and comments, also between progressive scans, and
    // everything after the first image's end marker (phones append depth maps and other pictures there, each with its own EXIF).
    private static byte[]? Jpeg(byte[] b)
    {
        if (b.Length < 4 || b[0] != 0xFF || b[1] != 0xD8)
            return null;
        var output = new MemoryStream(b.Length);
        output.Write(b, 0, 2);
        var insertAt = 2; // the orientation block goes right after SOI, or after a JFIF header that follows SOI
        ushort? orientation = null;
        var i = 2;
        while (i < b.Length)
        {
            if (b[i] != 0xFF || i + 1 >= b.Length)
                return null;
            var marker = b[i + 1];
            if (marker == 0xFF) // fill byte
            {
                i++;
                continue;
            }
            if (marker == 0xD9) // end of the image: stop, and leave out anything after it
            {
                output.Write(b, i, 2);
                return orientation is > 1 and <= 8 ? Insert(output.ToArray(), insertAt, OrientationOnly(orientation.Value)) : output.ToArray();
            }
            if (marker is >= 0xD0 and <= 0xD7 or 0x01) // restart and TEM markers stand alone
            {
                output.Write(b, i, 2);
                i += 2;
                continue;
            }
            if (i + 4 > b.Length)
                return null;
            var length = (b[i + 2] << 8) | b[i + 3];
            if (length < 2 || i + 2 + length > b.Length)
                return null;
            var body = b.AsSpan(i + 4, length - 2);
            if (marker == 0xE1 && orientation is null && body.StartsWith("Exif\0\0"u8))
                orientation = ExifOrientation(body[6..]) ?? (ushort)1;
            var keep = marker switch
            {
                0xE0 => body.StartsWith("JFIF\0"u8),
                0xE2 => body.StartsWith("ICC_PROFILE\0"u8),
                0xEE => true,
                >= 0xE0 and <= 0xEF or 0xFE => false,
                _ => true
            };
            if (keep)
            {
                output.Write(b, i, 2 + length);
                if (marker == 0xE0 && insertAt == 2 && output.Length == 4 + length)
                    insertAt = (int)output.Length;
            }
            i += 2 + length;
            if (marker != 0xDA)
                continue;
            // Start of scan: copy the entropy-coded data up to the next real marker (FF00 is a stuffed byte, FFD0–FFD7 a restart marker).
            var start = i;
            while (i + 1 < b.Length && !(b[i] == 0xFF && b[i + 1] != 0x00 && b[i + 1] is < 0xD0 or > 0xD7))
                i++;
            if (i + 1 >= b.Length)
                return null;
            output.Write(b, start, i - start);
        }
        return null; // no end-of-image marker
    }

    // The orientation tag (0x0112) of the first IFD of an EXIF TIFF block, in either byte order; null when absent or unreadable.
    internal static ushort? ExifOrientation(ReadOnlySpan<byte> tiff)
    {
        if (tiff.Length < 8)
            return null;
        var little = tiff[0] == (byte)'I' && tiff[1] == (byte)'I';
        if (!little && !(tiff[0] == (byte)'M' && tiff[1] == (byte)'M'))
            return null;
        static ushort U16(ReadOnlySpan<byte> data, int at, bool little) =>
            little ? BinaryPrimitives.ReadUInt16LittleEndian(data[at..]) : BinaryPrimitives.ReadUInt16BigEndian(data[at..]);
        var ifd = little ? BinaryPrimitives.ReadUInt32LittleEndian(tiff[4..]) : BinaryPrimitives.ReadUInt32BigEndian(tiff[4..]);
        if (ifd > tiff.Length - 2)
            return null;
        var count = U16(tiff, (int)ifd, little);
        for (var entry = (int)ifd + 2; count-- > 0 && entry + 12 <= tiff.Length; entry += 12)
            if (U16(tiff, entry, little) == 0x0112 && U16(tiff, entry + 2, little) == 3)
                return U16(tiff, entry + 8, little);
        return null;
    }

    // An APP1 EXIF block with one entry, the orientation; nothing else about the photo or the device.
    internal static byte[] OrientationOnly(ushort orientation) =>
    [
        0xFF, 0xE1, 0x00, 0x22, (byte)'E', (byte)'x', (byte)'i', (byte)'f', 0, 0,
        (byte)'M', (byte)'M', 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,
        0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, (byte)orientation, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00
    ];

    private static byte[] Insert(byte[] image, int at, byte[] block) => [.. image[..at], .. block, .. image[at..]];

    // Drops the EXIF, text and time chunks and anything after IEND; every other chunk (image, colour, transparency) is kept as it was.
    private static readonly string[] PngMetadata = ["eXIf", "tEXt", "zTXt", "iTXt", "tIME"];

    private static byte[]? Png(byte[] b)
    {
        if (b.Length < 8)
            return null;
        var output = new MemoryStream(b.Length);
        output.Write(b, 0, 8);
        for (var i = 8; i + 12 <= b.Length;)
        {
            var length = BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(i));
            if (length > int.MaxValue - 12 || i + 12L + length > b.Length)
                return null;
            var type = Encoding.ASCII.GetString(b, i + 4, 4);
            var size = 12 + (int)length;
            if (!PngMetadata.Contains(type))
                output.Write(b, i, size);
            i += size;
            if (type == "IEND")
                return output.ToArray();
        }
        return null; // no IEND
    }

    // RIFF chunks: drops EXIF and XMP and clears their two flags in VP8X; the image chunks are kept as they were. Bytes past the RIFF
    // size are left out, and the RIFF size is rewritten.
    private static byte[]? Webp(byte[] b)
    {
        if (b.Length < 12)
            return null;
        var end = 8L + BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(4));
        if (end > b.Length)
            return null;
        var output = new MemoryStream(b.Length);
        output.Write(b, 0, 12);
        for (var i = 12L; i < end;)
        {
            if (i + 8 > end)
                return null;
            var size = BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan((int)i + 4));
            if (i + 8 + size > end)
                return null;
            var total = (int)Math.Min(8L + size + (size & 1), end - i); // chunks are padded to an even length
            var fourcc = Encoding.ASCII.GetString(b, (int)i, 4);
            if (fourcc is not ("EXIF" or "XMP "))
            {
                var at = (int)output.Length;
                output.Write(b, (int)i, total);
                if (fourcc == "VP8X" && size >= 1)
                    output.GetBuffer()[at + 8] &= unchecked((byte)~0x0C); // EXIF (0x08) and XMP (0x04) flags
            }
            i += total;
        }
        var result = output.ToArray();
        BinaryPrimitives.WriteUInt32LittleEndian(result.AsSpan(4), (uint)(result.Length - 8));
        return result;
    }
}
