// Purpose: one shard of an anonymous daily public-site counter: allowlisted kind, language and optional parish with a count; no visitor, IP, device or referrer data.
// Main members: Day, Kind, Language, ParishId, Shard, Count.

namespace ParishLife.Api.Models;

public class SiteMetric
{
    public DateOnly Day { get; set; }

    public string Kind { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string? ParishId { get; set; } = null;

    public int Shard { get; set; }

    public long Count { get; set; }
}
