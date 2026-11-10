// Purpose: shows a staged or committed people import with its provenance, counts by outcome and every row.
// Main members: Id, Version, SourceName, SourceOwner, SourceDate, Status, Counts, Rows, StagedBy, StagedAt, CommittedBy and CommittedAt.

namespace ParishLife.Api.DTOs.People;

public class PeopleImportDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string SourceName { get; set; } = string.Empty;

    public string SourceOwner { get; set; } = string.Empty;

    public DateOnly SourceDate { get; set; }

    public string Status { get; set; } = string.Empty;

    public Dictionary<string, int> Counts { get; set; } = new();

    public PeopleImportRowDto[] Rows { get; set; } = Array.Empty<PeopleImportRowDto>();

    public string StagedBy { get; set; } = string.Empty;

    public DateTimeOffset StagedAt { get; set; }

    public string? CommittedBy { get; set; }

    public DateTimeOffset? CommittedAt { get; set; }
}
