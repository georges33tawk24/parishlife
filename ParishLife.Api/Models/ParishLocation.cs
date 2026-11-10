// Purpose: the parish's recorded map location: verified latitude/longitude with the source they came from, or an explicit cleared state.
// Nothing derives coordinates from a name or locality; a parish without this record simply has no map position.
// Main members: ParishId, Latitude, Longitude, SourceReference, RecordedBy, RecordedAt and IsRecorded.

namespace ParishLife.Api.Models;

public class ParishLocation
{
    public string ParishId { get; set; } = string.Empty;

    public decimal? Latitude { get; set; } = null;

    public decimal? Longitude { get; set; } = null;

    public string? SourceReference { get; set; } = null;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public bool IsRecorded() => Latitude is not null && Longitude is not null;
}
