// Purpose: the parish work overview for the current viewer: only the queues their permissions cover, with when it was computed.
// Main members: ParishId, GeneratedAt and Counts.

namespace ParishLife.Api.DTOs.Reporting;

public class WorkOverviewDto
{
    public string ParishId { get; set; } = string.Empty;

    public DateTimeOffset GeneratedAt { get; set; }

    public WorkCountDto[] Counts { get; set; } = Array.Empty<WorkCountDto>();
}
