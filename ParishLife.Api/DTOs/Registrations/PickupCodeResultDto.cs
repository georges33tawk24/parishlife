// Purpose: the result of a pickup-code action. Code holds the plain code only in the response that issued it; replays and reads never return it.
// Main members: RegistrationId, Action, Code, IssuedAt and Note.

namespace ParishLife.Api.DTOs.Registrations;

public class PickupCodeResultDto
{
    public string RegistrationId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string? Code { get; set; } = null;

    public DateTimeOffset? IssuedAt { get; set; } = null;

    public string Note { get; set; } = string.Empty;
}
