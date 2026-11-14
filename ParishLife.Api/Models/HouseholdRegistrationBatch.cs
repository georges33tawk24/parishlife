// Purpose: the stored result of registering several members of one household for an event in one transaction.
// Main members: Id (the operation id), EventId, HouseholdId and RegistrationIds.

namespace ParishLife.Api.Models;

public class HouseholdRegistrationBatch
{
    public string Id { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string HouseholdId { get; set; } = string.Empty;

    public string[] RegistrationIds { get; set; } = Array.Empty<string>();
}
