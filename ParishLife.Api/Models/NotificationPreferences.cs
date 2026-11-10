// Purpose: holds one account's notification choices; required notices cannot be muted.
// Main members: MutedTopics, Language and DigestOptional.

namespace ParishLife.Api.Models;

public class NotificationPreferences
{
    public string[] MutedTopics { get; set; } = Array.Empty<string>();

    public string Language { get; set; } = "en";

    public bool DigestOptional { get; set; }
}
