// Purpose: one UTC day's count on the platform insights page (for example accounts created that day).
// Main members: Day, Count.

namespace ParishLife.Api.DTOs.Reporting;

public class DayCountDto
{
    public DateOnly Day { get; set; }

    public int Count { get; set; }
}
