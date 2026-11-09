// Purpose: returns a reviewed personal identity link without matching evidence or verifier identity.
// Main members: ParishId, PersonId, AccountId, Active, VerifiedAt.

namespace ParishLife.Api.DTOs.Ministries;

public class PersonAccountLinkDto
{
    public string ParishId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public bool Active { get; set; }

    public DateTimeOffset VerifiedAt { get; set; }
}
