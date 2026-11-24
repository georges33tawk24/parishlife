// Purpose: stores anonymous daily public-site counters without receipts, audit or visitor data, and reads one day's counters back.
// Main functions: IncrementAsync (returns whether the increment was stored), DayAsync and PurgeDayAsync (retention: removes one day's counters).

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Reporting;

public interface ISiteMetricStore
{
    Task<bool> IncrementAsync(DateOnly day, string kind, string language, string? parishId, CancellationToken ct);

    Task<IReadOnlyList<SiteMetric>> DayAsync(DateOnly day, CancellationToken ct);

    Task<int> PurgeDayAsync(DateOnly day, CancellationToken ct);
}
