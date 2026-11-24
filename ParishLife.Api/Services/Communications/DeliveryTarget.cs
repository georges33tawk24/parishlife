// Purpose: where one account can be reached outside the app, read fresh for each delivery.
// Main members: AccountId, Email (only a confirmed address), Phone (only a verified WhatsApp number), Devices (allowed push devices with
// their stored row versions) and Preferences (which channels the person wants).

using ParishLife.Api.Models;

namespace ParishLife.Api.Services.Communications;

public class DeliveryTarget
{
    public string AccountId { get; set; } = string.Empty;

    public string? Email { get; set; } = null;

    public string? Phone { get; set; } = null;

    public List<Versioned<PushDevice>> Devices { get; set; } = [];

    public NotificationPreferences Preferences { get; set; } = new();
}
