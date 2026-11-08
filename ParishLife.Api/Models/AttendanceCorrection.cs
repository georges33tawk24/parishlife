// Purpose: represents attendance correction business state and rules.
// Main members: Id, AttendanceId, PreviousStatus, NewStatus, Reason, RecordedBy, At.

namespace ParishLife.Api.Models;

public class AttendanceCorrection
{
    public string Id { get; set; } = string.Empty;

    public string AttendanceId { get; set; } = string.Empty;

    public string PreviousStatus { get; set; } = string.Empty;

    public string NewStatus { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
