// Purpose: one preparation requirement on a sacramental case, copied from the parish list, with whether the office recorded it as met.
// Main members: Key, Label, LabelAr, Met, RecordedBy, RecordedAt and Note.

namespace ParishLife.Api.Models;

public class SacramentRequirementState
{
    public string Key { get; set; } = string.Empty;

    public string? Label { get; set; } = null;

    public string? LabelAr { get; set; } = null;

    public bool Met { get; set; }

    public string? RecordedBy { get; set; } = null;

    public DateTimeOffset? RecordedAt { get; set; } = null;

    public string? Note { get; set; } = null;
}
