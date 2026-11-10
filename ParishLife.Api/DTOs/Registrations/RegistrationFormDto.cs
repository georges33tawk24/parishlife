// Purpose: returns one immutable registration form version.
// Main members: Id, EventId, Fields and CreatedAt.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Registrations;

public class RegistrationFormDto
{
    public string Id { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public RegistrationField[] Fields { get; set; } = Array.Empty<RegistrationField>();

    public DateTimeOffset CreatedAt { get; set; }
}
