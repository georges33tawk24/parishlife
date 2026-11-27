// Purpose: one person offered by the household member search, with the household they already belong to (if any) so the office
// can see who must first leave another household.
// Main members: Id, GivenName, FamilyName, GivenNameAr, FamilyNameAr, BirthDate, HouseholdId, HouseholdName and HouseholdNameAr.

namespace ParishLife.Api.DTOs.People;

public class HouseholdCandidateDto
{
    public string Id { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public string? GivenNameAr { get; set; } = null;

    public string? FamilyNameAr { get; set; } = null;

    public DateOnly? BirthDate { get; set; }

    // The person's current primary household; null when they have none.
    public string? HouseholdId { get; set; } = null;

    public string? HouseholdName { get; set; } = null;

    public string? HouseholdNameAr { get; set; } = null;
}
