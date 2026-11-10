// Purpose: optional office-maintained facts about a person beyond the core record: structured locality, occupation, skills, language and deceased status.
// Main members: PersonId, ParishId, Country, Region, District, Town, AddressDetail, LocalityNotListed, Occupation, Skills, PreferredLanguage,
// DeceasedOn, DeceasedPrecision, DeceasedEvidence, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.Models;

public class PersonFacts
{
    public string PersonId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string? Country { get; set; }

    public string? Region { get; set; }

    public string? District { get; set; }

    public string? Town { get; set; }

    public string? AddressDetail { get; set; }

    // Submitted text kept as given when the locality is not in a verified list; it stays labelled pending.
    public string? LocalityNotListed { get; set; }

    public string? Occupation { get; set; }

    public string[] Skills { get; set; } = Array.Empty<string>();

    public string? PreferredLanguage { get; set; }

    // Kept as supplied: yyyy-MM-dd for Exact, yyyy for Year, null for Unknown.
    public string? DeceasedOn { get; set; }

    public string? DeceasedPrecision { get; set; }

    public string? DeceasedEvidence { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
