// Purpose: one outside delivery channel for notices and broadcasts (email, push, WhatsApp).
// Main members: Name (stored in DeliveryWork.DoneChannels), Configured, and SendAsync, which checks the person's choice and address itself
// and returns Sent, Skipped or Failed. Implementations never log message text, addresses or secrets.

using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Interfaces.Services.Communications;

public interface IDeliveryChannel
{
    string Name { get; }

    bool Configured { get; }

    Task<DeliveryOutcome> SendAsync(DeliveryTarget target, DeliveryMessage message, CancellationToken ct);
}
