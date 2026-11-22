// Purpose: the result of "Send a test notification": what happened on each outside channel for the caller alone.
// Main members: Push, Email and WhatsApp, each one of sent (the provider accepted it; not proof of receipt), not-enabled (not set up on
// this site, or the person turned it off), no-device / no-address / no-number (nothing to send to) or failed; RemainingToday.

namespace ParishLife.Api.DTOs.Communications;

public class NotificationTestDto
{
    public string Push { get; set; } = "not-enabled";

    public string Email { get; set; } = "not-enabled";

    public string WhatsApp { get; set; } = "not-enabled";

    public int RemainingToday { get; set; }
}
