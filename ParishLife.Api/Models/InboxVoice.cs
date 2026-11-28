// Purpose: a voice note attached to one inbox message: where its audio is stored privately and what it is.
// Main members: StoragePath, ContentType (detected from the bytes), Size, Sha256 and Seconds (as recorded by the sender's browser).

namespace ParishLife.Api.Models;

public class InboxVoice
{
    public string StoragePath { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long Size { get; set; }

    public string Sha256 { get; set; } = string.Empty;

    public int Seconds { get; set; }
}
