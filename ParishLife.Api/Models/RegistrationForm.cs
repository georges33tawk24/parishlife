// Purpose: represents registration form business state and rules.
// Main members: Id, EventId, Fields, CreatedAt, CreatedBy.

namespace ParishLife.Api.Models;

public class RegistrationForm
{
    public string Id { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public RegistrationField[] Fields { get; set; } = Array.Empty<RegistrationField>();

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;
}
