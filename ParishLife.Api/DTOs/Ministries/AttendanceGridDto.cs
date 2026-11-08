// Purpose: represents attendance grid input/output data.
// Main members: MeetingId, Status, Version, Rows, PresentOrLate, Recorded, NotRecorded.

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceGridDto
{
    public string MeetingId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public AttendanceRowDto[] Rows { get; set; } = Array.Empty<AttendanceRowDto>();

    public int PresentOrLate { get; set; }

    public int Recorded { get; set; }

    public int NotRecorded { get; set; }
}
