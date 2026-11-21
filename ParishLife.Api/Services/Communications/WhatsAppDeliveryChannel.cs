// Purpose: the WhatsApp channel for notices and broadcasts: only to a number the person proved, and only if they turned WhatsApp on.
// Main members: Name ("WhatsApp"), Configured and SendAsync (the notice template with the title; a broadcast sends its title, and the full
// text stays in the app behind the link the approved template carries).

using ParishLife.Api.Interfaces.Services.Communications;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class WhatsAppDeliveryChannel(WhatsAppSender sender) : IDeliveryChannel
{
    public string Name => "WhatsApp";

    public bool Configured => sender.Configured;

    public async Task<DeliveryOutcome> SendAsync(DeliveryTarget target, DeliveryMessage message, CancellationToken ct)
    {
        if (!Configured || !target.Preferences.WhatsApp || string.IsNullOrWhiteSpace(target.Phone))
            return DeliveryOutcome.Skipped;
        return await sender.SendNoticeAsync(target.Phone, message.Title, message.Language, ct) ? DeliveryOutcome.Sent : DeliveryOutcome.Failed;
    }
}
