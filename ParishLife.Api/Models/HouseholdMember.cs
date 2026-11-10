// Purpose: records a person's single primary household and whether they inherit its address.
// Main members: PersonId, HouseholdId, InheritsAddress, OwnAddress, JoinedAt and UpdatedBy.

namespace ParishLife.Api.Models;

public class HouseholdMember
{
    public string PersonId { get; set; } = string.Empty;

    // Empty after the person leaves without joining another household.
    public string HouseholdId { get; set; } = string.Empty;

    public bool InheritsAddress { get; set; }

    public string? OwnAddress { get; set; } = null;

    public DateTimeOffset JoinedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;
}
