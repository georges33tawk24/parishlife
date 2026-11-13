// Purpose: returns the bounded list of resources shared with the ministries the signed-in member currently belongs to.
// Main members: Items (sorted by ministry and item name) and Truncated, true when the bound left resources out.

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class MemberMinistryResourcesDto
{
    public MemberMinistryResourceDto[] Items { get; set; } = Array.Empty<MemberMinistryResourceDto>();
    public bool Truncated { get; set; }
}
