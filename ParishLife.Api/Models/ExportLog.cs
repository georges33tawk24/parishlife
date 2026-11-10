// Purpose: records who exported which personal data, for what purpose and with what scope and row count.
// Main members: Id, ParishId, Kind, Purpose, Columns, IncludeArchived, Count, By and At.

namespace ParishLife.Api.Models;

public class ExportLog
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string[] Columns { get; set; } = Array.Empty<string>();

    public bool IncludeArchived { get; set; }

    public int Count { get; set; }

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
