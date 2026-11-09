// Purpose: exposes separately labeled recorded guest totals without adding them to member coverage or absence denominators.
// Main members: Total, Present, Late, Absent, Excused, NotExpected and NotRecorded; total is recorded rows, not a claim of complete guest capture.

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceGuestCountsDto
{
    public int Total { get; set; }

    public int Present { get; set; }

    public int Late { get; set; }

    public int Absent { get; set; }

    public int Excused { get; set; }

    public int NotExpected { get; set; }

    public int NotRecorded { get; set; }
}
