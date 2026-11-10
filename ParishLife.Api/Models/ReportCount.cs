// Purpose: one counted work-overview queue as stored in a delivered report snapshot, with the permission that guards it so every later read
// can recheck the reader's current access before showing the count.
// Main members: Area, Queue, Permission, Count, Unit, Statuses and Route.

namespace ParishLife.Api.Models;

public class ReportCount
{
    public string Area { get; set; } = string.Empty;

    public string Queue { get; set; } = string.Empty;

    public string Permission { get; set; } = string.Empty;

    public int Count { get; set; }

    public string Unit { get; set; } = string.Empty;

    public string[] Statuses { get; set; } = Array.Empty<string>();

    public string Route { get; set; } = string.Empty;
}
