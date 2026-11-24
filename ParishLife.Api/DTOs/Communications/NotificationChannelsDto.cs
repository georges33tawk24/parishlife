// Purpose: what the caller can use to receive notices outside the app, and what they have set up.
// Main members: Email (configured here) and EmailAddressConfirmed, Push (configured), PushPublicKey (for the browser to subscribe) and
// PushDevices (how many devices are registered), WhatsApp (configured), WhatsAppPhone and WhatsAppStatus (None, Pending or Verified).

namespace ParishLife.Api.DTOs.Communications;

public class NotificationChannelsDto
{
    public bool Email { get; set; }

    public bool EmailAddressConfirmed { get; set; }

    public bool Push { get; set; }

    public string? PushPublicKey { get; set; } = null;

    public int PushDevices { get; set; }

    public bool WhatsApp { get; set; }

    public string? WhatsAppPhone { get; set; } = null;

    public string WhatsAppStatus { get; set; } = "None";
}
