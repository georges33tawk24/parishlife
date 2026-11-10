// Purpose: shows a person's optional facts, with the locality status spelled out.
// Main members: PersonId, locality fields, LocalityStatus, Occupation, Skills, PreferredLanguage, deceased fields, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.DTOs.People;

public class PersonFactsDto
{
    public string PersonId { get; set; } = string.Empty;

    public string? Country { get; set; }

    public string? Region { get; set; }

    public string? District { get; set; }

    public string? Town { get; set; }

    public string? AddressDetail { get; set; }

    public string? LocalityNotListed { get; set; }

    public string LocalityStatus { get; set; } = string.Empty;

    public string? Occupation { get; set; }

    public string[] Skills { get; set; } = Array.Empty<string>();

    public string? PreferredLanguage { get; set; }

    public bool Deceased { get; set; }

    public string? DeceasedOn { get; set; }

    public string? DeceasedPrecision { get; set; }

    public string? DeceasedEvidence { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
