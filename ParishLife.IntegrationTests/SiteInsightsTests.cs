// Purpose: verifies public-site metrics and Super Admin Insights (X06) through the real local services and storage.
// Main tests: anonymous beacons add only allowlisted aggregate counts (no visitor data) for verified parishes; invalid beacons are refused;
// concurrent beacons never inflate counts; insights are limited to current MFA platform operators, contain no parish names or private data,
// report parish setup coverage, and validate their period.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Interfaces.Repositories.Reporting;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Reporting;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class SiteInsightsTests
{
    private static SiteInsightsService Insights(LocalBackendFixture f) => f.Services.GetRequiredService<SiteInsightsService>();

    private static async Task<(LocalBackendFixture F, StaffAppointmentScenario S)> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        Assert.StartsWith(Path.GetTempPath(), f.DirectoryPath);
        return (f, await StaffAppointmentScenario.CreateAsync(f));
    }

    private static RecordSiteMetricDto Beacon(string kind, string? language = null, string? parish = null)
        => new() { Kind = kind, Language = language, ParishId = parish is null ? null : Guid.Parse(parish) };

    [Fact]
    public async Task Beacons_become_anonymous_daily_counts_that_only_operators_read()
    {
        var (f, s) = await StartAsync();
        await using var _ = f;
        f.As(f.FirstAdmin);
        var pending = await f.Services.GetRequiredService<ParishService>().RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(), Name = "Pending isolated parish", Locality = "Elsewhere", Contact = "fixture.example"
        }, default);
        // Visitors are anonymous: no principal at all.
        f.Services.GetRequiredService<Microsoft.AspNetCore.Http.IHttpContextAccessor>().HttpContext = null;
        var metrics = Insights(f);
        Assert.True(await metrics.RecordAsync(Beacon("home.view", "en"), default));
        Assert.True(await metrics.RecordAsync(Beacon("home.view", "en"), default));
        Assert.True(await metrics.RecordAsync(Beacon("home.view"), default));
        Assert.True(await metrics.RecordAsync(Beacon("parish.view", "ar", s.Parish), default));

        async Task Refuse(RecordSiteMetricDto beacon) => Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => metrics.RecordAsync(beacon, default))).Code);
        await Refuse(Beacon("search.query"));
        await Refuse(Beacon("home.view", "de"));
        await Refuse(Beacon("home.view", "en", s.Parish));
        await Refuse(Beacon("parish.view", "en"));
        await Refuse(Beacon("parish.view", "en", pending.Id));
        await Refuse(Beacon("request.start", "en", Guid.NewGuid().ToString("N")));

        // Stored counters hold only the allowlisted dimensions.
        var stored = await f.Services.GetRequiredService<ISiteMetricStore>().DayAsync(DateOnly.FromDateTime(f.Clock.Now.UtcDateTime), default);
        var raw = System.Text.Json.JsonSerializer.Serialize(stored);
        Assert.Equal(4, stored.Sum(m => m.Count));
        foreach (var forbidden in new[] { "ip", "visitor", "agent", "referrer", "address" })
            Assert.DoesNotContain(forbidden, raw, StringComparison.OrdinalIgnoreCase);

        f.As(f.FirstAdmin);
        var today = DateOnly.FromDateTime(f.Clock.Now.UtcDateTime);
        var insights = await metrics.InsightsAsync(today.AddDays(-1), today, default);
        Assert.Equal(2, insights.SiteMetrics.Single(c => c is { Kind: "home.view", Language: "en" }).Count);
        Assert.Equal(1, insights.SiteMetrics.Single(c => c is { Kind: "home.view", Language: "unknown" }).Count);
        Assert.Equal((s.Parish, 1L), insights.SiteMetrics.Where(c => c.Kind == "parish.view").Select(c => (c.ParishId!, c.Count)).Single());
        Assert.Equal(1, insights.ParishesByStatus.Single(c => c.Status == nameof(ParishStatus.Verified)).Count);
        Assert.Equal(1, insights.ParishesByStatus.Single(c => c.Status == nameof(ParishStatus.PendingVerification)).Count);
        Assert.Equal((1, 1), (insights.ParishesWithJurisdiction, insights.ParishesWithoutJurisdiction));
        Assert.NotEmpty(insights.Notes);
        var json = System.Text.Json.JsonSerializer.Serialize(insights);
        Assert.DoesNotContain("Isolated parish", json);
        Assert.DoesNotContain(f.Nominee, json);

        // A bishop, ordinary accounts, an operator without MFA, in a recovery session or in a selected appointment get nothing.
        var member = await f.CreateVerifiedMemberAsync();
        foreach (var denied in new Action[] { () => f.As(f.Nominee), () => f.As(member, mfa: false), () => f.As(f.FirstAdmin, mfa: false), () => f.AsRecovery(f.FirstAdmin),
            () => f.AsAppointment(f.FirstAdmin, Guid.NewGuid().ToString("N")) })
        {
            denied();
            Assert.Equal(FailureKind.Forbidden, (await Assert.ThrowsAsync<DomainException>(() => metrics.InsightsAsync(today, today, default))).Kind);
        }
    }

    [Fact]
    public async Task Concurrent_beacons_never_inflate_counts_and_periods_are_bounded()
    {
        var (f, _) = await StartAsync();
        await using var fixture = f;
        var store = f.Services.GetRequiredService<ISiteMetricStore>();
        var day = DateOnly.FromDateTime(f.Clock.Now.UtcDateTime);
        var results = await Task.WhenAll(Enumerable.Range(0, 24).Select(_ => store.IncrementAsync(day, "home.view", "fr", null, default)));
        Assert.Equal(results.Count(r => r), (await store.DayAsync(day, default)).Sum(m => m.Count));
        Assert.True(results.Count(r => r) > 0);

        f.As(f.FirstAdmin);
        var metrics = Insights(f);
        Assert.Equal("invalid_period", (await Assert.ThrowsAsync<DomainException>(() => metrics.InsightsAsync(day, day.AddDays(-1), default))).Code);
        Assert.Equal("invalid_period", (await Assert.ThrowsAsync<DomainException>(() => metrics.InsightsAsync(day.AddDays(-93), day, default))).Code);
        Assert.Equal("invalid_period", (await Assert.ThrowsAsync<DomainException>(() => metrics.InsightsAsync(default, day, default))).Code);
        Assert.Empty((await metrics.InsightsAsync(day.AddDays(-92), day.AddDays(-1), default)).SiteMetrics);
    }
}
