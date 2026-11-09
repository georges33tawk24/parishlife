// Purpose: keeps recorded guest/additional-row totals separate from expected-member attendance denominators.
// Main members: Total and the six explicit observed/unknown status counters; no membership or expected participation is inferred.

namespace ParishLife.Api.Models;

public class AttendanceGuestCounts
{
    public int Total { get; set; }

    public int Present { get; set; }

    public int Late { get; set; }

    public int Absent { get; set; }

    public int Excused { get; set; }

    public int NotExpected { get; set; }

    public int NotRecorded { get; set; }
}
