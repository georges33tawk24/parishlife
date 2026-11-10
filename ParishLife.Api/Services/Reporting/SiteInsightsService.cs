// Purpose: privacy-preserving public-site metrics and the Super Admin Insights page. Visitors' beacons add to anonymous daily counters for an
// allowlisted kind, language and optional verified parish: no IP, visitor key, device, referrer, search text or location is stored. Insights are
// read only by current MFA platform operators and contain aggregate site counts and parish setup coverage; they never include clergy, person,
// case or finance records, and grant no access to any of them.
// Main functions: RecordAsync (anonymous) and InsightsAsync (operator).

using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Repositories.Reporting;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Reporting;

public class SiteInsightsService(ISiteMetricStore metrics, IParishRepository parishes, IParishDirectory directory, IPlatformAccess platform,
    MfaAccountAccess proof, TimeProvider clock)
{
    // Kinds that need a parish carry one; the homepage kind must not.
    internal static readonly IReadOnlyDictionary<string, bool> Kinds = new Dictionary<string, bool>(StringComparer.Ordinal)
    {
        ["home.view"] = false, ["directory.view"] = false, ["parish.view"] = true, ["request.start"] = true
    };
    internal static readonly string[] Languages = ["en", "fr", "ar"];
    // A technical bound on one synchronous read, not a retention period.
    internal const int MaximumDays = 93;

    private static readonly string[] Notes =
    [
        "Site counts come from untrusted anonymous beacons: they are approximate lower bounds (an increment that keeps conflicting is dropped), not audited facts, and bots or blocked scripts are not distinguished.",
        "No IP address, visitor identifier, device, referrer, search text or location is stored with a count.",
        "No retention period is approved for these aggregates; nothing is purged automatically.",
        "Parish counts describe platform setup only; they are not rankings or health scores and include no clergy, person, case or finance records."
    ];

    public async Task<bool> RecordAsync(RecordSiteMetricDto request, CancellationToken ct)
    {
        var kind = request.Kind?.Trim() ?? string.Empty;
        if (!Kinds.TryGetValue(kind, out var needsParish))
            throw new DomainException("invalid_input", "Use an allowlisted metric kind.");
        var language = request.Language is null ? "unknown" : Languages.Contains(request.Language) ? request.Language : throw new DomainException("invalid_input", "Use en, fr or ar.");
        string? parish = null;
        if (needsParish != request.ParishId is not null)
            throw new DomainException("invalid_input", needsParish ? "This metric needs the parish." : "This metric does not take a parish.");
        if (request.ParishId is { } id)
        {
            parish = Guard.Id(id);
            // Only verified parishes have public pages; anything else would let a beacon create arbitrary counters.
            if ((await parishes.GetAsync(parish, ct))?.Value.Status != ParishStatus.Verified)
                throw new DomainException("invalid_input", "The parish has no public page.");
        }
        return await metrics.IncrementAsync(DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime), kind, language, parish, ct);
    }

    public async Task<PlatformInsightsDto> InsightsAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await platform.RequireOperatorAsync(ct);
        if (from == default || to < from || to.DayNumber - from.DayNumber + 1 > MaximumDays)
            throw new DomainException("invalid_period", "Give UTC days from..to (inclusive), at most " + MaximumDays + " days.");
        var counts = new List<SiteMetricCountDto>();
        for (var day = from; day <= to; day = day.AddDays(1))
            counts.AddRange((await metrics.DayAsync(day, ct))
                .GroupBy(m => (m.Kind, m.Language, m.ParishId))
                .Select(g => new SiteMetricCountDto { Day = day, Kind = g.Key.Kind, Language = g.Key.Language, ParishId = g.Key.ParishId, Count = g.Sum(m => m.Count) })
                .OrderBy(c => c.Kind, StringComparer.Ordinal).ThenBy(c => c.Language, StringComparer.Ordinal).ThenBy(c => c.ParishId, StringComparer.Ordinal));
        var all = await directory.AllAsync(ct);
        return new PlatformInsightsDto
        {
            From = from, To = to, GeneratedAt = clock.GetUtcNow(), SiteMetrics = [.. counts], Notes = Notes,
            ParishesByStatus = [.. Enum.GetValues<ParishStatus>().Select(s => new ParishStatusCountDto { Status = s.ToString(), Count = all.Count(p => p.Status == s) })],
            ParishesWithJurisdiction = all.Count(p => p.JurisdictionArchdioceseId is not null),
            ParishesWithoutJurisdiction = all.Count(p => p.JurisdictionArchdioceseId is null)
        };
    }
}
