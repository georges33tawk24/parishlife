// Purpose: returns one opening or closing checklist step of a reservation.
// Main members: Phase, Label, LabelAr, Done, DoneBy and DoneAt.

namespace ParishLife.Api.DTOs.Scheduling;

public class ReservationChecklistItemDto
{
    public string Phase { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public string? LabelAr { get; set; } = null;

    public bool Done { get; set; }

    public string? DoneBy { get; set; } = null;

    public DateTimeOffset? DoneAt { get; set; } = null;
}
