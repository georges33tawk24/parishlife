// Purpose: one participant on an evacuation roll call as an assigned door operator sees it: name and accounted-for mark only.
// Main members: RegistrationId, PersonId, DisplayName, AccountedAt and AccountedBy.

namespace ParishLife.Api.DTOs.Registrations;

public class EvacuationEntryDto
{
    public string RegistrationId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public DateTimeOffset? AccountedAt { get; set; } = null;

    public string? AccountedBy { get; set; } = null;
}
