// Purpose: returns one household member with the address that actually applies to them.
// Main members: PersonId, DisplayName, DisplayNameAr (null when no Arabic name is recorded), InheritsAddress, EffectiveAddress and IsContact.

namespace ParishLife.Api.DTOs.People;

public class HouseholdMemberDto
{
    public string PersonId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? DisplayNameAr { get; set; } = null;

    public bool InheritsAddress { get; set; }

    public string? EffectiveAddress { get; set; } = null;

    public bool IsContact { get; set; }
}
