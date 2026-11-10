// Purpose: returns one append-only household change with the value it replaced.
// Main members: Id, HouseholdId, PersonId, Action, Previous, RecordedBy and RecordedAt.

namespace ParishLife.Api.DTOs.People;

public class HouseholdChangeDto
{
    public string Id { get; set; } = string.Empty;

    public string HouseholdId { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string Action { get; set; } = string.Empty;

    public string? Previous { get; set; } = null;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
