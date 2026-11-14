// Purpose: one opening or closing checklist step that the office typed for a reservation, with who ticked it and when.
// Main members: Phase, Label, LabelAr, Done, DoneBy and DoneAt.

namespace ParishLife.Api.Models;

public class ReservationChecklistItem
{
    // Opening or Closing.
    public string Phase { get; set; } = "Opening";

    public string Label { get; set; } = string.Empty;

    public string? LabelAr { get; set; } = null;

    public bool Done { get; set; }

    public string? DoneBy { get; set; } = null;

    public DateTimeOffset? DoneAt { get; set; } = null;
}
