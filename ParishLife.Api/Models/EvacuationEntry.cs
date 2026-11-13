// Purpose: one participant in an evacuation roll call and whether an operator marked them accounted for.
// Main members: RegistrationId, PersonId, AccountedAt and AccountedBy.

namespace ParishLife.Api.Models;

public class EvacuationEntry
{
    public string RegistrationId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public DateTimeOffset? AccountedAt { get; set; } = null;

    public string? AccountedBy { get; set; } = null;
}
