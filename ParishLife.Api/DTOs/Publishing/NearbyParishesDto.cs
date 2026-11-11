// Purpose: a visitor's point for nearby sorting, sent in the request body so precise coordinates stay out of URLs and logs; never stored.
// Main members: Latitude, Longitude, optional RadiusKm and optional name/place Query.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Publishing;

public class NearbyParishesDto
{
    [Required, Range(-90.0, 90.0)]
    public decimal? Latitude { get; set; }

    [Required, Range(-180.0, 180.0)]
    public decimal? Longitude { get; set; }

    [Range(0.1, 1000.0)]
    public double? RadiusKm { get; set; }

    [StringLength(100)]
    public string? Query { get; set; }
}
