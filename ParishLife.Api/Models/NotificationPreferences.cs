// Purpose: holds one account's notification choices; required notices cannot be muted.
// Main members: MutedTopics, Language, DigestOptional, and the outside channels a stored notice or broadcast is also sent on:
// Email (on by default; only to a confirmed address), Push (on by default; only to devices the person allowed) and WhatsApp (off until
// the person proves a number). Stored rows written before these existed read with these defaults.

namespace ParishLife.Api.Models;

public class NotificationPreferences
{
    public string[] MutedTopics { get; set; } = Array.Empty<string>();

    public string Language { get; set; } = "en";

    public bool DigestOptional { get; set; }

    public bool Email { get; set; } = true;

    public bool Push { get; set; } = true;

    public bool WhatsApp { get; set; } = false;
}
