// Purpose: keeps anonymous public-site counters in one Catalog partition per UTC day, spread over a few shards so concurrent beacons rarely
// conflict. Each increment is a conditional create/replace; after a few conflicts it is dropped and reported as not stored (counts are a
// lower bound, never inflated). No receipt or audit row is written for an untrusted beacon.
// Main functions: IncrementAsync and DayAsync.

using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Reporting;
using ParishLife.Api.Models;

namespace ParishLife.Api.Repositories.Reporting;

internal sealed class SiteMetricStore(PartitionDocuments documents) : ISiteMetricStore
{
    private const int Shards = 4;
    private const int Attempts = 3;

    private static string Key(DateOnly day) => "platform:site-metrics-" + day.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture);

    public async Task<bool> IncrementAsync(DateOnly day, string kind, string language, string? parishId, CancellationToken ct)
    {
        var key = Key(day);
        for (var attempt = 0; attempt < Attempts; attempt++)
        {
            var shard = Random.Shared.Next(Shards);
            var id = "siteMetric:" + kind + ":" + language + ":" + (parishId ?? "none") + ":" + shard;
            try
            {
                var row = await documents.ReadAsync<SiteMetric>(Containers.Catalog, key, id, ct);
                if (row is null)
                    await documents.CreateAsync(Containers.Catalog, JsonDefaults.Row(id, key, "siteMetric",
                        new SiteMetric { Day = day, Kind = kind, Language = language, ParishId = parishId, Shard = shard, Count = 1 }), ct);
                else
                {
                    row.Value.Count++;
                    await documents.ReplaceAsync(Containers.Catalog, JsonDefaults.Row(id, key, "siteMetric", row.Value), row.Version, ct);
                }
                return true;
            }
            catch (Models.DomainException error) when (error.Code == "write_conflict") { }
        }
        return false;
    }

    // ponytail: one bounded single-partition read per day; a very large parish dimension fails honestly with query_bound_exceeded.
    public Task<IReadOnlyList<SiteMetric>> DayAsync(DateOnly day, CancellationToken ct)
        => documents.QueryAsync<SiteMetric>(Containers.Catalog, Key(day), StorageQuery.Type("siteMetric"), ct, 20000);
}
