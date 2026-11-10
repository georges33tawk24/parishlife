// Purpose: the map projection of parishes in the bishop's jurisdiction; only recorded coordinates are positioned, the rest are listed without a pin.
// Main members: ArchdioceseId, GeneratedAt, Located, NotLocated, Parishes.

namespace ParishLife.Api.DTOs.Reporting;

public class BishopMapDto
{
    public string ArchdioceseId { get; set; } = string.Empty;

    public DateTimeOffset GeneratedAt { get; set; }

    public int Located { get; set; }

    public int NotLocated { get; set; }

    public ParishMapEntryDto[] Parishes { get; set; } = Array.Empty<ParishMapEntryDto>();
}
