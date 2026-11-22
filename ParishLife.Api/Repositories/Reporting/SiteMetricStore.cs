// Purpose: keeps anonymous public-site counters in one Catalog partition per UTC day, spread over a few shards so concurrent beacons rarely
// conflict. Each increment is a conditional create/replace; after a few conflicts it is dropped and reported as not stored (counts are a
// lower bound, never inflated). No receipt or audit row is written for an untrusted beacon.
// Main functions: IncrementAsync, DayAsync and PurgeDayAsync (removes a day's counters once they pass the retention period).

using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Reporting;
using ParishLife.Api.Models;

namespace ParishLife.Api.Repositories.Reporting;

internal sealed class SiteMetricStore(PartitionDocuments documents) : ISiteMetricStore
{
    private const int Shards = 4;
    private const int Attempts = 3;

    private static string Id(SiteMetric metric) => "siteMetric:" + metric.Kind + ":" + metric.Language + ":" + (metric.ParishId ?? "none") + ":" + metric.Shard;

    private static string Key(DateOnly day) => "platform:site-metrics-" + day.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture);

    public async Task<bool> IncrementAsync(DateOnly day, string kind, string language, string? parishId, CancellationToken ct)
    {
        var key = Key(day);
        for (var attempt = 0; attempt < Attempts; attempt++)
        {
            var shard = Random.Shared.Next(Shards);
            var id = Id(new SiteMetric { Kind = kind, Language = language, ParishId = parishId, Shard = shard });
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

    // Deletes the day's counters page by page (each page one conditional batch in the day's partition); returns how many were removed.
    public async Task<int> PurgeDayAsync(DateOnly day, CancellationToken ct)
    {
        var key = Key(day);
        var removed = 0;
        while (true)
        {
            var page = await documents.QueryPageAsync<SiteMetric>(Containers.Catalog, key, StorageQuery.Type("siteMetric"), 100, null, ct);
            if (page.Items.Count == 0)
                return removed;
            var batch = documents.Batch(Containers.Catalog, key);
            foreach (var row in page.Items)
                batch.DeleteItem(Id(row.Value), row.Version);
            using var outcome = await batch.ExecuteAsync(ct);
            if (!outcome.IsSuccessStatusCode)
                return removed; // a counter changed meanwhile; the next run tries again
            removed += page.Items.Count;
        }
    }

    // ponytail: one bounded single-partition read per day; a very large parish dimension fails honestly with query_bound_exceeded.
    public Task<IReadOnlyList<SiteMetric>> DayAsync(DateOnly day, CancellationToken ct)
        => documents.QueryAsync<SiteMetric>(Containers.Catalog, Key(day), StorageQuery.Type("siteMetric"), ct, 20000);
}
