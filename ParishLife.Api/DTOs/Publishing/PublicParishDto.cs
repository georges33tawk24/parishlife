// Purpose: one parish card in the anonymous public directory: only verified public identity, recorded coordinates and public links.
// Main members: ParishId, Name, Locality, DioceseName, Latitude, Longitude, DistanceKm (approximate, only for a caller-supplied point) and Links.

namespace ParishLife.Api.DTOs.Publishing;

public class PublicParishDto
{
    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string? DioceseName { get; set; } = null;

    public decimal? Latitude { get; set; } = null;

    public decimal? Longitude { get; set; } = null;

    public double? DistanceKm { get; set; } = null;

    public PublicParishLinksDto Links { get; set; } = new();
}
