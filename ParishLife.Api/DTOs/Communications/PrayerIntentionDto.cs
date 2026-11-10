// Purpose: returns a prayer intention to its submitter or a priest; public readers receive only published text and an allowed name.
// Main members: Id, Text, DisplayName, RequestedVisibility, Status and SubmittedAt.

namespace ParishLife.Api.DTOs.Communications;

public class PrayerIntentionDto
{
    public string Id { get; set; } = string.Empty;

    public string Text { get; set; } = string.Empty;

    public string? DisplayName { get; set; } = null;

    public string? RequestedVisibility { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }
}
