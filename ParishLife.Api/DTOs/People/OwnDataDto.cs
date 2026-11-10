// Purpose: a member's own data in one parish: their person record, optional facts, consents and how many records of each class refer to them.
// Main members: PersonId, GivenName, FamilyName, BirthDate, Contact, Facts, Consents and Records.

namespace ParishLife.Api.DTOs.People;

public class OwnDataDto
{
    public string PersonId { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; }

    public string? Contact { get; set; }

    public PersonFactsDto? Facts { get; set; }

    public ConsentDto[] Consents { get; set; } = Array.Empty<ConsentDto>();

    public Dictionary<string, int> Records { get; set; } = new();
}
