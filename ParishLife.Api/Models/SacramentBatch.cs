// Purpose: records a group sacrament request (first communion or confirmation candidates opened together) with each person's outcome,
// committed in the same transaction as the cases it opened, so a retry of the same operation returns these results unchanged.
// Main members: Id, ParishId, Kind, Entries, CreatedBy and CreatedAt.

namespace ParishLife.Api.Models;

public class SacramentBatch
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public SacramentBatchEntry[] Entries { get; set; } = Array.Empty<SacramentBatchEntry>();

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
