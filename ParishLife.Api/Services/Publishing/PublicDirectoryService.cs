// Purpose: the anonymous all-parish directory (X09/D01): verified parishes only, their public name/locality/diocese, coordinates only when a parish
// manager actually recorded them (ParishLocation), approximate server-side distance from a caller-supplied point, and links to existing public reads
// and the existing follow action. Nothing is geocoded, guessed, ranked or stored about the visitor.
// Main functions: BrowseAsync (name order, optional text query), NearbyAsync (distance order, optional radius, unknown locations kept apart) and
// DistanceKm (haversine, no external service).

using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Services.Publishing;

public class PublicDirectoryService(IParishDirectory directory, IParishRepository parishes, IRecordTransactions records)
{
    private const double EarthRadiusKm = 6371.0088;

    public async Task<PublicParishDirectoryDto> BrowseAsync(string? query, CancellationToken ct)
    {
        var items = Filter(await CardsAsync(ct), query).OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase).ThenBy(c => c.Locality, StringComparer.OrdinalIgnoreCase).ToArray();
        return new PublicParishDirectoryDto { Items = items, Total = items.Length };
    }

    // Parishes without a recorded location never appear to meet a radius; they are returned separately, in name order.
    public async Task<PublicParishDirectoryDto> NearbyAsync(NearbyParishesDto request, CancellationToken ct)
    {
        if (request.Latitude is not { } lat || request.Longitude is not { } lon || lat is < -90 or > 90 || lon is < -180 or > 180)
            throw new DomainException("invalid_input", "Give a latitude within -90..90 and a longitude within -180..180.");
        if (request.RadiusKm is { } r && (double.IsNaN(r) || r is < 0.1 or > 1000))
            throw new DomainException("invalid_input", "Use a radius between 0.1 and 1000 km.");
        var cards = Filter(await CardsAsync(ct), request.Query).ToArray();
        foreach (var card in cards.Where(c => c.Latitude is not null))
            card.DistanceKm = Math.Round(DistanceKm((double)lat, (double)lon, (double)card.Latitude!.Value, (double)card.Longitude!.Value), 1);
        var located = cards.Where(c => c.DistanceKm is not null).ToArray();
        var within = located.Where(c => request.RadiusKm is null || c.DistanceKm <= request.RadiusKm)
            .OrderBy(c => c.DistanceKm).ThenBy(c => c.Name, StringComparer.OrdinalIgnoreCase).ToArray();
        var unknown = cards.Where(c => c.DistanceKm is null).OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase).ToArray();
        return new PublicParishDirectoryDto
        {
            Items = within, DistanceUnavailable = unknown, OutsideRadius = located.Length - within.Length, DistanceApproximate = true, Total = within.Length + unknown.Length
        };
    }

    internal static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        static double Rad(double degrees) => degrees * Math.PI / 180;
        var a = Math.Pow(Math.Sin(Rad(lat2 - lat1) / 2), 2) + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Pow(Math.Sin(Rad(lon2 - lon1) / 2), 2);
        return 2 * EarthRadiusKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static IEnumerable<PublicParishDto> Filter(IEnumerable<PublicParishDto> cards, string? query)
    {
        var text = query?.Trim() ?? string.Empty;
        if (text.Length > 100)
            throw new DomainException("invalid_input", "Search with at most 100 characters.");
        return text.Length == 0 ? cards : cards.Where(c => c.Name.Contains(text, StringComparison.OrdinalIgnoreCase)
            || c.Locality.Contains(text, StringComparison.OrdinalIgnoreCase) || c.DioceseName?.Contains(text, StringComparison.OrdinalIgnoreCase) == true);
    }

    // ponytail: one location point read per verified parish and one read per diocese (bounded by ParishDirectory.Maximum); materialize a public
    // directory projection when parish counts make this slow.
    private async Task<List<PublicParishDto>> CardsAsync(CancellationToken ct)
    {
        var dioceses = new Dictionary<string, string?>(StringComparer.Ordinal);
        var cards = new List<PublicParishDto>();
        foreach (var parish in await directory.AllAsync(ct))
        {
            if (parish.Status != ParishStatus.Verified)
                continue;
            string? diocese = null;
            if (parish.JurisdictionArchdioceseId is { } id && !dioceses.TryGetValue(id, out diocese))
                dioceses[id] = diocese = (await parishes.GetArchdioceseAsync(id, ct))?.Value is { Verified: true } org ? org.Name : null;
            var location = (await records.ReadAsync<ParishLocation>(new RecordScope { Area = RecordArea.Parish, OwnerId = parish.Id }, ParishLocationService.Key, ct))?.Value;
            var recorded = location is not null && location.ParishId == parish.Id && location.IsRecorded();
            cards.Add(new PublicParishDto
            {
                ParishId = parish.Id, Name = parish.Name, Locality = parish.Locality, DioceseName = diocese,
                Latitude = recorded ? location!.Latitude : null, Longitude = recorded ? location!.Longitude : null,
                Links = new PublicParishLinksDto
                {
                    Website = "/api/public/parishes/" + parish.Id + "/website", Calendar = "/api/public/parishes/" + parish.Id + "/calendar",
                    Ministries = "/api/public/parishes/" + parish.Id + "/ministries", LiturgicalCalendar = "/api/public/parishes/" + parish.Id + "/liturgical-calendar",
                    Requests = "/api/public/parishes/" + parish.Id + "/requests", Follow = "/api/parishes/" + parish.Id + "/follow"
                }
            });
        }
        return cards;
    }
}
