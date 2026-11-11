// Purpose: one anonymous public read that responds with a revalidatable ETag and a short public max-age.
// Main members: Method, Template and MaxAgeSeconds.

namespace ParishLife.Api.DTOs.Publishing;

public class PublicCacheRouteDto
{
    public string Method { get; set; } = "GET";

    public string Template { get; set; } = string.Empty;

    public int MaxAgeSeconds { get; set; }
}
