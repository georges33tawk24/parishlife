// Purpose: returns one household member with the address that actually applies to them and their recorded role.
// Main members: PersonId, DisplayName, DisplayNameAr (null when no Arabic name is recorded), InheritsAddress, EffectiveAddress, IsContact and Role.

namespace ParishLife.Api.DTOs.People;

public class HouseholdMemberDto
{
    public string PersonId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? DisplayNameAr { get; set; } = null;

    public bool InheritsAddress { get; set; }

    public string? EffectiveAddress { get; set; } = null;

    public bool IsContact { get; set; }

    // Head, Spouse, Child, OtherRelative...; null when the office has not recorded one.
    public string? Role { get; set; } = null;
}
