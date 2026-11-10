// Purpose: the parish's recorded map location as shown to its managers: Recorded with coordinates and source, or NotRecorded.
// Main members: ParishId, Status, Latitude, Longitude, SourceReference, RecordedBy and RecordedAt.

namespace ParishLife.Api.DTOs.Organizations;

public class ParishLocationDto
{
    public string ParishId { get; set; } = string.Empty;

    public string Status { get; set; } = "NotRecorded";

    public decimal? Latitude { get; set; } = null;

    public decimal? Longitude { get; set; } = null;

    public string? SourceReference { get; set; } = null;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
