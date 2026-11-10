// Purpose: one staged import row with its original values, normalized result, problems and outcome.
// Main members: Line, Original, GivenName, FamilyName, BirthDate, Contact, SourceId, Problems, Outcome and PersonId.

namespace ParishLife.Api.Models;

public class PeopleImportRow
{
    public int Line { get; set; }

    public string Original { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; }

    public string? Contact { get; set; }

    public string SourceId { get; set; } = string.Empty;

    public string[] Problems { get; set; } = Array.Empty<string>();

    // Valid, Error, Duplicate (already imported from this source), PossibleDuplicate (matches a current person) or Imported.
    public string Outcome { get; set; } = "Valid";

    public string? PersonId { get; set; }
}
