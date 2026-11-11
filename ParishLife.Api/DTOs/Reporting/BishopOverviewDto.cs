// Purpose: the bishop's aggregate overview of parishes in his current jurisdiction for an explicit period, with definitions, exclusions and alphabetical (not ranked) order.
// Main members: ArchdioceseId, From, To, GeneratedAt, Ordering, Measures, Excluded, Parishes, Totals.

namespace ParishLife.Api.DTOs.Reporting;

public class BishopOverviewDto
{
    public string ArchdioceseId { get; set; } = string.Empty;

    public DateTimeOffset From { get; set; }

    public DateTimeOffset To { get; set; }

    public DateTimeOffset GeneratedAt { get; set; }

    public string Ordering { get; set; } = string.Empty;

    public MeasureDefinitionDto[] Measures { get; set; } = Array.Empty<MeasureDefinitionDto>();

    public string[] Excluded { get; set; } = Array.Empty<string>();

    public ParishOverviewDto[] Parishes { get; set; } = Array.Empty<ParishOverviewDto>();

    public OverviewTotalsDto Totals { get; set; } = new();
}
