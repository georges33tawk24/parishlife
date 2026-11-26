// Purpose: records a person's single primary household, whether they inherit its address, and their role in that household.
// Main members: PersonId, HouseholdId, InheritsAddress, OwnAddress, Role, JoinedAt and UpdatedBy.

namespace ParishLife.Api.Models;

public class HouseholdMember
{
    public string PersonId { get; set; } = string.Empty;

    // Empty after the person leaves without joining another household.
    public string HouseholdId { get; set; } = string.Empty;

    public bool InheritsAddress { get; set; }

    public string? OwnAddress { get; set; } = null;

    // The member's place in this household as the office recorded it (Head, Spouse, Child, OtherRelative...); null when not recorded.
    // It belongs to the membership, not to the Person, is cleared when they leave, and grants no guardianship or other authority.
    public string? Role { get; set; } = null;

    public DateTimeOffset JoinedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;
}
