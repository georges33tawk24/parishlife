// Purpose: returns a profile correction with per-field decisions.
// Main members: Id, PersonId, Fields, Status and dates.

namespace ParishLife.Api.DTOs.People;

public class ProfileCorrectionDto
{
    public string Id { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public ProfileCorrectionFieldDto[] Fields { get; set; } = Array.Empty<ProfileCorrectionFieldDto>();

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; } = null;
}
