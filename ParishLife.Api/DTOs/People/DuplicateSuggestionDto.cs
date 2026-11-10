// Purpose: one suggested duplicate pair with why it matched and where the records differ.
// Main members: PersonA, PersonB, NameA, NameB, Signals, Differences, LinkedA, LinkedB and Decision.

namespace ParishLife.Api.DTOs.People;

public class DuplicateSuggestionDto
{
    public string PersonA { get; set; } = string.Empty;

    public string PersonB { get; set; } = string.Empty;

    public string NameA { get; set; } = string.Empty;

    public string NameB { get; set; } = string.Empty;

    public string[] Signals { get; set; } = Array.Empty<string>();

    public string[] Differences { get; set; } = Array.Empty<string>();

    public bool LinkedA { get; set; }

    public bool LinkedB { get; set; }

    public string? Decision { get; set; }
}
