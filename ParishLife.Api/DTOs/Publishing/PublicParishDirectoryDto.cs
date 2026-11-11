// Purpose: the anonymous parish directory result: matching parishes and, for a nearby search, those without a recorded location kept apart.
// Main members: Items, DistanceUnavailable, OutsideRadius (known-location parishes beyond the radius, not returned), DistanceApproximate and Total.

namespace ParishLife.Api.DTOs.Publishing;

public class PublicParishDirectoryDto
{
    public PublicParishDto[] Items { get; set; } = Array.Empty<PublicParishDto>();

    public PublicParishDto[] DistanceUnavailable { get; set; } = Array.Empty<PublicParishDto>();

    public int OutsideRadius { get; set; }

    public bool DistanceApproximate { get; set; }

    public int Total { get; set; }
}
