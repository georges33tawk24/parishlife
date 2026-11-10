// Purpose: represents one append-only household change with its previous values.
// Main members: Id, HouseholdId, PersonId, Action, Previous, RecordedBy and RecordedAt.

namespace ParishLife.Api.Models;

public class HouseholdChange
{
    public string Id { get; set; } = string.Empty;

    public string HouseholdId { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string Action { get; set; } = string.Empty;

    // A compact description of the replaced value (old contact, address, envelope or household).
    public string? Previous { get; set; } = null;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
