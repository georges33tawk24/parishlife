// Purpose: one counted queue on the parish work overview, with its unit and the statuses it counts.
// Main members: Area, Queue, Count, Unit, Statuses and Route.

namespace ParishLife.Api.DTOs.Reporting;

public class WorkCountDto
{
    public string Area { get; set; } = string.Empty;

    public string Queue { get; set; } = string.Empty;

    public int Count { get; set; }

    public string Unit { get; set; } = string.Empty;

    public string[] Statuses { get; set; } = Array.Empty<string>();

    public string Route { get; set; } = string.Empty;
}
