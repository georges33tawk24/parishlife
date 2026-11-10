// Purpose: shows the invitation holder what accepting does; names appear only while the invitation is usable.
// Main members: Status, ParishName, PersonName, Purpose and ExpiresAt.

namespace ParishLife.Api.DTOs.People;

public class PersonInvitationPreviewDto
{
    public string Status { get; set; } = string.Empty;

    public string? ParishName { get; set; }

    public string? PersonName { get; set; }

    public string Purpose { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }
}
