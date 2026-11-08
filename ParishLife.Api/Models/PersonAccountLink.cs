// Purpose: represents person account link business state and rules.
// Main members: Id, ParishId, PersonId, AccountId, VerifiedBy, VerifiedAt, EvidenceReference, and related workflow details.

namespace ParishLife.Api.Models;

public class PersonAccountLink
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string VerifiedBy { get; set; } = string.Empty;

    public DateTimeOffset VerifiedAt { get; set; }

    public string EvidenceReference { get; set; } = string.Empty;

    public bool Active { get; set; } = true;
}
