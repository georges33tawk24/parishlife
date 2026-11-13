// Purpose: one person matching an office search, with only the fields needed to pick the right record.
// Main members: Id, GivenName, FamilyName, GivenNameAr, FamilyNameAr, BirthDate and Archived.

namespace ParishLife.Api.DTOs.People;

public class PersonSearchResultDto
{
    public string Id { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public string? GivenNameAr { get; set; } = null;

    public string? FamilyNameAr { get; set; } = null;

    public DateOnly? BirthDate { get; set; }

    public bool Archived { get; set; }
}
