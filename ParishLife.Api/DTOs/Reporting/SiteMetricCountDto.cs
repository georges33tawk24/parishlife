// Purpose: an aggregated public-site count for one day, kind, language and optional parish (shards summed).
// Main members: Day, Kind, Language, ParishId, Count.

namespace ParishLife.Api.DTOs.Reporting;

public class SiteMetricCountDto
{
    public DateOnly Day { get; set; }

    public string Kind { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string? ParishId { get; set; } = null;

    public long Count { get; set; }
}
