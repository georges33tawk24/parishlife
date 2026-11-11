// Purpose: verifies the anonymous all-parish directory (X09/D01) and public install/offline metadata (X11) through real local services and HTTP.
// Main tests: only verified parishes appear with public fields and recorded coordinates; nearby search sorts by approximate distance, honours the
// radius and keeps unknown locations apart; cacheable public reads carry ETags and answer 304 while private and error responses stay no-store;
// the manifest exists only from valid operator configuration; the offline policy lists exactly the marked public reads.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Publishing;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PublicDirectoryTests
{
    private static async Task<string> ParishAsync(LocalBackendFixture f, string name, string locality, bool verify)
    {
        f.As(f.FirstAdmin);
        var service = f.Services.GetRequiredService<ParishService>();
        var parish = await service.RegisterAsync(new RegisterParishDto { OperationId = Guid.NewGuid(), Name = name, Locality = locality, Contact = "private-office@fixture.example" }, default);
        if (verify)
            await service.VerifyAsync(parish.Id, new VerifyParishDto
            {
                OperationId = Guid.NewGuid(), Version = (await f.Services.GetRequiredService<IParishRepository>().GetAsync(parish.Id, default))!.Version,
                EvidenceReference = "isolated representative verification"
            }, default);
        return parish.Id;
    }

    private static async Task<string> LocateAsync(LocalBackendFixture f, string parish, decimal? lat, decimal? lon, string? version = null)
    {
        f.As(f.FirstAdmin);
        return (await f.Services.GetRequiredService<ParishLocationService>().SetAsync(parish, new SetParishLocationDto
        {
            OperationId = Guid.NewGuid(), Latitude = lat, Longitude = lon, Version = version, SourceReference = lat is null ? null : "isolated surveyed coordinates"
        }, default)).Version;
    }

    [Fact]
    public async Task Directory_shows_only_verified_public_fields_and_recorded_coordinates_sorted_by_distance()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        var beta = await ParishAsync(f, "Beta chapel", "Harbour", verify: true);
        await ParishAsync(f, "Pending church", "Harbour", verify: false);
        var version = await LocateAsync(f, staff.Parish, 33.90m, 35.50m);
        var directory = f.Services.GetRequiredService<PublicDirectoryService>();
        f.Services.GetRequiredService<Microsoft.AspNetCore.Http.IHttpContextAccessor>().HttpContext = null;

        var all = await directory.BrowseAsync(null, default);
        Assert.Equal(["Beta chapel", "Isolated parish"], all.Items.Select(p => p.Name).ToArray());
        var located = all.Items[1];
        Assert.Equal(("Isolated organization", 33.90m, 35.50m), (located.DioceseName, located.Latitude, located.Longitude));
        Assert.Equal((null, null, null), (all.Items[0].DioceseName, all.Items[0].Latitude, all.Items[0].Longitude));
        Assert.Equal("/api/parishes/" + staff.Parish + "/follow", located.Links.Follow);
        Assert.Equal("/api/public/parishes/" + staff.Parish + "/website", located.Links.Website);
        // Only these public members exist: no contact, owner, verification evidence or location source.
        Assert.Equal(["DioceseName", "DistanceKm", "Latitude", "Links", "Locality", "Longitude", "Name", "ParishId"],
            typeof(PublicParishDto).GetProperties().Select(p => p.Name).Order(StringComparer.Ordinal).ToArray());
        Assert.Equal([beta], (await directory.BrowseAsync("harbour", default)).Items.Select(p => p.ParishId).ToArray());
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => directory.BrowseAsync(new string('x', 101), default))).Code);

        var near = await directory.NearbyAsync(new NearbyParishesDto { Latitude = 33.89m, Longitude = 35.50m, RadiusKm = 5 }, default);
        Assert.True(near.DistanceApproximate);
        Assert.Equal((staff.Parish, 1.1), (Assert.Single(near.Items).ParishId, near.Items[0].DistanceKm!.Value));
        Assert.Equal(beta, Assert.Single(near.DistanceUnavailable).ParishId);
        Assert.Null(near.DistanceUnavailable[0].DistanceKm);
        // A tight radius genuinely limits known locations; unknown ones are never presented as inside it.
        var tight = await directory.NearbyAsync(new NearbyParishesDto { Latitude = 33.89m, Longitude = 35.50m, RadiusKm = 0.5 }, default);
        Assert.Equal((0, 1, 1), (tight.Items.Length, tight.OutsideRadius, tight.DistanceUnavailable.Length));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => directory.NearbyAsync(new NearbyParishesDto { Latitude = 91, Longitude = 0 }, default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => directory.NearbyAsync(new NearbyParishesDto { Latitude = null, Longitude = 0 }, default))).Code);
        Assert.InRange(PublicDirectoryService.DistanceKm(0, 0, 0, 1), 111.1, 111.3);

        // Clearing the recorded location removes the coordinates; nothing is guessed from the locality.
        await LocateAsync(f, staff.Parish, null, null, version);
        var cleared = await directory.NearbyAsync(new NearbyParishesDto { Latitude = 33.89m, Longitude = 35.50m }, default);
        Assert.Empty(cleared.Items);
        Assert.Equal(2, cleared.DistanceUnavailable.Length);
    }

    [Fact]
    public async Task Public_reads_are_revalidatable_while_private_and_error_responses_stay_no_store()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await ParishAsync(f, "Beta chapel", "Harbour", verify: true);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        var client = factory.Client();

        var first = await client.GetAsync("/api/public/parishes");
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal("public, max-age=300", first.Headers.CacheControl!.ToString());
        var tag = first.Headers.ETag!.Tag;
        var again = new HttpRequestMessage(HttpMethod.Get, "/api/public/parishes");
        again.Headers.TryAddWithoutValidation("If-None-Match", tag);
        Assert.Equal(HttpStatusCode.NotModified, (await client.SendAsync(again)).StatusCode);
        var stale = new HttpRequestMessage(HttpMethod.Get, "/api/public/parishes");
        stale.Headers.TryAddWithoutValidation("If-None-Match", "\"stale\"");
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(stale)).StatusCode);

        var missing = await client.GetAsync("/api/public/homepage");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.True(missing.Headers.CacheControl!.NoStore);
        Assert.Null(missing.Headers.ETag);
        var manifest = await client.GetAsync("/api/public/app/manifest");
        Assert.Equal(HttpStatusCode.NotFound, manifest.StatusCode);
        Assert.Contains("app_manifest_not_configured", await manifest.Content.ReadAsStringAsync());
        Assert.True(manifest.Headers.CacheControl!.NoStore);
        var personal = await client.GetAsync("/api/me/home");
        Assert.NotEqual(HttpStatusCode.OK, personal.StatusCode);
        Assert.True(personal.Headers.CacheControl!.NoStore);

        var policy = await client.GetFromJsonAsync<OfflinePolicyDto>("/api/public/app/offline-policy");
        Assert.Equal(("no-store", "NotSupported"), (policy!.DefaultPolicy, policy.OfflineWrites));
        Assert.Equal(["/api/public/app/manifest", "/api/public/app/offline-policy", "/api/public/homepage", "/api/public/parishes",
            "/api/public/parishes/{parishId:guid}/liturgical-calendar", "/api/public/parishes/{parishId:guid}/website"],
            policy.CacheableReads.Select(r => r.Template).ToArray());
    }

    [Fact]
    public void Manifest_comes_only_from_valid_operator_configuration()
    {
        static PublicAppService App(Dictionary<string, string?> values) => new(new ConfigurationBuilder().AddInMemoryCollection(values).Build());
        Assert.Equal("app_manifest_not_configured", Assert.Throws<DomainException>(() => App([]).Manifest()).Code);

        var valid = new Dictionary<string, string?>
        {
            ["PublicApp:Name"] = "Operator supplied name", ["PublicApp:StartUrl"] = "/start", ["PublicApp:Display"] = "standalone",
            ["PublicApp:ThemeColor"] = "#112233", ["PublicApp:Icons:0:Src"] = "/icons/app-192.png", ["PublicApp:Icons:0:Sizes"] = "192x192", ["PublicApp:Icons:0:Type"] = "image/png"
        };
        var manifest = App(valid).Manifest();
        Assert.Equal(("Operator supplied name", "Operator supplied name", "/start", "standalone", "#112233"),
            (manifest.Name, manifest.ShortName, manifest.StartUrl, manifest.Display, manifest.ThemeColor));
        Assert.Equal("/icons/app-192.png", Assert.Single(manifest.Icons).Src);

        foreach (var (key, bad) in new[] { ("PublicApp:ThemeColor", "red"), ("PublicApp:StartUrl", "https://elsewhere.example/"), ("PublicApp:Icons:0:Src", "javascript:alert(1)"), ("PublicApp:Display", "kiosk") })
        {
            var broken = new Dictionary<string, string?>(valid) { [key] = bad };
            Assert.Equal("app_manifest_misconfigured", Assert.Throws<DomainException>(() => App(broken).Manifest()).Code);
        }
    }
}
