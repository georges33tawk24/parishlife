// Purpose: a privately staged people import with its provenance, every validated row and the reviewer's commit outcome.
// Main members: Id, ParishId, SourceName, SourceOwner, SourceDate, DateOrder, Rows, Status, StagedBy, StagedAt, CommittedBy and CommittedAt.

namespace ParishLife.Api.Models;

public class PeopleImport
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string SourceName { get; set; } = string.Empty;

    public string SourceOwner { get; set; } = string.Empty;

    public DateOnly SourceDate { get; set; }

    public string? DateOrder { get; set; }

    public List<PeopleImportRow> Rows { get; set; } = new();

    // Staged, Committing or Committed.
    public string Status { get; set; } = "Staged";

    public string StagedBy { get; set; } = string.Empty;

    public DateTimeOffset StagedAt { get; set; }

    public string? CommittedBy { get; set; }

    public DateTimeOffset? CommittedAt { get; set; }
}
