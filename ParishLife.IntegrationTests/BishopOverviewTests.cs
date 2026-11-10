// Purpose: verifies the bishop overview and map (O08) and recorded parish locations through the real local services and storage.
// Main tests: only parishes in the bishop's recorded jurisdiction appear, alphabetically, with defined period/now counts and distinct priest
// totals; non-bishops, unselected/other capacities, missing MFA and recovery sessions are refused; no request contents leak; periods are
// validated; the map positions only coordinates a manager recorded, and location writes are versioned, replayable and validated.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Reporting;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class BishopOverviewTests
{
    private static async Task<(LocalBackendFixture F, StaffAppointmentScenario S, string Outside)> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        Assert.StartsWith(Path.GetTempPath(), f.DirectoryPath);
        var s = await StaffAppointmentScenario.CreateAsync(f);
        await s.ActivateOfficeAsync(["core", "office", "requests"]);
        // A verified parish outside any jurisdiction must never appear.
        f.As(f.FirstAdmin);
        var outside = await f.Services.GetRequiredService<ParishService>().RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(), Name = "Another isolated parish", Locality = "Elsewhere", Contact = "fixture.example"
        }, default);
        return (f, s, outside.Id);
    }

    private static BishopOverviewService Overview(LocalBackendFixture f) => f.Services.GetRequiredService<BishopOverviewService>();

    private static GuestRequestDto Guest() => new()
    {
        OperationId = Guid.NewGuid(), Kind = "Blessing", Summary = "Private house blessing detail", Details = new() { ["address"] = "Isolated street" },
        RequesterName = "Isolated guest name", RequesterContact = "guest@fixture.example", SubjectDescription = "Our new home"
    };

    [Fact]
    public async Task Bishop_sees_only_his_jurisdiction_with_defined_counts_and_no_record_contents()
    {
        var (f, s, outside) = await StartAsync();
        await using var _ = f;
        await s.AcceptAsync(await s.InviteAsync(f.Other, head: true));
        await f.Services.GetRequiredService<RequestService>().GuestSubmitAsync(s.Parish, Guest(), default);
        await f.Services.GetRequiredService<RequestService>().GuestSubmitAsync(s.Parish, Guest(), default);

        f.As(f.Nominee);
        var now = f.Clock.Now;
        var result = await Overview(f).OverviewAsync(s.Organization, now.AddDays(-1), now.AddDays(1), default);
        var row = Assert.Single(result.Parishes);
        Assert.Equal(s.Parish, row.ParishId);
        Assert.DoesNotContain(result.Parishes, p => p.ParishId == outside);
        Assert.Equal((1, true, 0, 2, 2, 0, 0), (row.CurrentPriests, row.HeadPriestDesignated, row.OtherCurrentStaff, row.OpenRequests, row.RequestsReceived,
            row.CertificatesAwaitingBishop, row.MembershipRequestsPending));
        Assert.Equal((1, 0, 1, 2), (result.Totals.Parishes, result.Totals.ParishesWithoutHeadPriest, result.Totals.CurrentPriests, result.Totals.OpenRequests));
        Assert.Contains(result.Measures, m => m.Key == "requestsReceived" && m.Basis == "period");
        Assert.Contains("not ranked", result.Ordering);
        Assert.NotEmpty(result.Excluded);

        // The period applies only to period measures: an earlier window received nothing, while open work is still counted now.
        var earlier = await Overview(f).OverviewAsync(s.Organization, now.AddDays(-30), now.AddDays(-20), default);
        Assert.Equal((0, 2), (earlier.Parishes[0].RequestsReceived, earlier.Parishes[0].OpenRequests));

        var json = System.Text.Json.JsonSerializer.Serialize(result);
        foreach (var secret in new[] { "Private house blessing detail", "Isolated guest name", "guest@fixture.example", "Isolated street", f.Other })
            Assert.DoesNotContain(secret, json);
    }

    [Fact]
    public async Task Only_a_current_mfa_bishop_in_his_own_capacity_may_read_the_overview_and_map()
    {
        var (f, s, _) = await StartAsync();
        await using var _f = f;
        var now = f.Clock.Now;
        var member = await f.CreateVerifiedMemberAsync();
        foreach (var denied in new Action[]
        {
            () => f.As(f.FirstAdmin), () => f.As(f.Other), () => f.As(member, mfa: false), () => f.As(f.Nominee, mfa: false),
            () => f.AsRecovery(f.Nominee), () => f.AsAppointment(f.Nominee, Guid.NewGuid().ToString("N"))
        })
        {
            denied();
            Assert.Equal(FailureKind.Forbidden, (await Assert.ThrowsAsync<DomainException>(() => Overview(f).OverviewAsync(s.Organization, now.AddDays(-1), now, default))).Kind);
            await Assert.ThrowsAsync<DomainException>(() => Overview(f).MapAsync(s.Organization, default));
        }
        // Another archdiocese is not his jurisdiction.
        var other = await f.OrganizationAsync();
        f.As(f.Nominee);
        await Assert.ThrowsAsync<DomainException>(() => Overview(f).OverviewAsync(other, now.AddDays(-1), now, default));
    }

    [Fact]
    public async Task Periods_must_be_explicit_utc_and_bounded()
    {
        var (f, s, _) = await StartAsync();
        await using var _f = f;
        f.As(f.Nominee);
        var now = f.Clock.Now;
        Assert.Equal("invalid_period", (await Assert.ThrowsAsync<DomainException>(() => Overview(f).OverviewAsync(s.Organization, now, now, default))).Code);
        Assert.Equal("invalid_period", (await Assert.ThrowsAsync<DomainException>(() => Overview(f).OverviewAsync(s.Organization, now.AddDays(-400), now, default))).Code);
        Assert.Equal("invalid_instant", (await Assert.ThrowsAsync<DomainException>(() => Overview(f).OverviewAsync(s.Organization, now.ToOffset(TimeSpan.FromHours(2)), now.AddDays(1), default))).Code);
        Assert.Equal("invalid_instant", (await Assert.ThrowsAsync<DomainException>(() => Overview(f).OverviewAsync(s.Organization, default, now, default))).Code);
    }

    [Fact]
    public async Task Map_positions_only_recorded_coordinates_and_location_writes_are_versioned()
    {
        var (f, s, _) = await StartAsync();
        await using var _f = f;
        var locations = f.Services.GetRequiredService<ParishLocationService>();

        f.As(f.Nominee);
        var empty = Assert.Single((await Overview(f).MapAsync(s.Organization, default)).Parishes);
        Assert.Equal(("NotRecorded", null, null), (empty.LocationStatus, empty.Latitude, empty.Longitude));
        // The bishop is not a parish manager and cannot record a location.
        await Assert.ThrowsAsync<DomainException>(() => locations.SetAsync(s.Parish, Set(33.9m, 35.5m), default));

        f.As(f.FirstAdmin);
        async Task Refuse(SetParishLocationDto request) => Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => locations.SetAsync(s.Parish, request, default))).Code);
        await Refuse(Set(33.9m, null));
        await Refuse(Set(95m, 35.5m));
        await Refuse(Set(33.9m, -181m));
        await Refuse(Set(33.9m, 35.5m, source: null));

        var request = Set(33.9m, 35.5m);
        var saved = await locations.SetAsync(s.Parish, request, default);
        Assert.Equal(saved.Version, (await locations.SetAsync(s.Parish, request, default)).Version);
        Assert.Equal("Recorded", saved.Value.Status);
        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => locations.SetAsync(s.Parish, Set(34m, 35m), default))).Code);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => locations.SetAsync(s.Parish, Set(34m, 35m, "stale"), default))).Code);

        f.As(f.Nominee);
        var map = await Overview(f).MapAsync(s.Organization, default);
        Assert.Equal((1, 0), (map.Located, map.NotLocated));
        Assert.Equal((33.9m, 35.5m, "isolated surveyed coordinates"), (map.Parishes[0].Latitude, map.Parishes[0].Longitude, map.Parishes[0].SourceReference));

        f.As(f.FirstAdmin);
        var cleared = await locations.SetAsync(s.Parish, Set(null, null, saved.Version, null), default);
        Assert.Equal(("NotRecorded", null), (cleared.Value.Status, cleared.Value.SourceReference));
        f.As(f.Nominee);
        Assert.Equal(0, (await Overview(f).MapAsync(s.Organization, default)).Located);
        f.As(f.Other);
        await Assert.ThrowsAsync<DomainException>(() => locations.GetAsync(s.Parish, default));
    }

    private static SetParishLocationDto Set(decimal? latitude, decimal? longitude, string? version = null, string? source = "isolated surveyed coordinates") => new()
    {
        OperationId = Guid.NewGuid(), Latitude = latitude, Longitude = longitude, Version = version, SourceReference = source
    };
}
