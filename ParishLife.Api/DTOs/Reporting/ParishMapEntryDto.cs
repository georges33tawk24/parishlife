// Purpose: one parish on the bishop map: recorded coordinates and their source, or NotRecorded with no position.
// Main members: ParishId, Name, Locality, Status, LocationStatus, Latitude, Longitude, SourceReference.

namespace ParishLife.Api.DTOs.Reporting;

public class ParishMapEntryDto
{
    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string LocationStatus { get; set; } = "NotRecorded";

    public decimal? Latitude { get; set; } = null;

    public decimal? Longitude { get; set; } = null;

    public string? SourceReference { get; set; } = null;
}
