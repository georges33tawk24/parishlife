// Purpose: registers this browser or phone for ParishLife push notifications (the browser's PushSubscription).
// Main members: Endpoint (must be a known push service), P256dh and Auth (the subscription's base64url keys) and an optional Label.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Communications;

public class SavePushDeviceDto
{
    [Required, StringLength(1000)]
    public string Endpoint { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string P256dh { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Auth { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Label { get; set; } = null;
}
