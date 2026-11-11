// Purpose: number of registered parishes in one status on the platform insights page.
// Main members: Status, Count.

namespace ParishLife.Api.DTOs.Reporting;

public class ParishStatusCountDto
{
    public string Status { get; set; } = string.Empty;

    public int Count { get; set; }
}
