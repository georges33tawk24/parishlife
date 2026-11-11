// Purpose: one delivery channel's honest state for a broadcast; external channels without a configured provider are never reported as sent.
// Main members: Channel (InApp, Email, Sms, Push) and Status (NotSent, Stored, NotConfigured).

namespace ParishLife.Api.DTOs.Communications;

public class BroadcastChannelDto
{
    public string Channel { get; set; } = "InApp";

    public string Status { get; set; } = "NotSent";
}
