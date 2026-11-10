// Purpose: a recipient's own copy of a sent parish broadcast, without other recipients or the sending staff account.
// Main members: Id, Title, Body, Language and SentAt.

namespace ParishLife.Api.DTOs.Communications;

public class ReceivedBroadcastDto
{
    public string Id { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Language { get; set; } = "en";

    public DateTimeOffset? SentAt { get; set; } = null;
}
