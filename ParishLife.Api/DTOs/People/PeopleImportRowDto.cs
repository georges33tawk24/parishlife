// Purpose: shows one staged row: the original line, the normalized values, problems and outcome.
// Main members: Line, Original, GivenName, FamilyName, BirthDate, Contact, SourceId, Problems, Outcome and PersonId.

namespace ParishLife.Api.DTOs.People;

public class PeopleImportRowDto
{
    public int Line { get; set; }

    public string Original { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; }

    public string? Contact { get; set; }

    public string SourceId { get; set; } = string.Empty;

    public string[] Problems { get; set; } = Array.Empty<string>();

    public string Outcome { get; set; } = string.Empty;

    public string? PersonId { get; set; }
}
