// Purpose: measures how many document operations (point reads, query pages, commits) the main public and signed-in HTTP requests make,
// through a counting decorator around the real local store, and prints a table for the performance report (Agent 04). It also holds the
// public read cache to its contract: a repeated public read touches no document, sign-ins do not clear it, a parish write does at once,
// and the cached answer has the same bytes, ETag and 304 revalidation as a computed one.
// Main tests: Main_requests_report_their_document_operation_counts; Directory_documents_of_every_parish_come_back_in_one_query_keyed_by_their_partition
// (the batched public-directory read, allow-listed types only); helpers create verified parishes with recorded locations through the
// host's own services and send one measured request each.

using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;
using Xunit.Abstractions;

namespace ParishLife.IntegrationTests;

public class RequestCostTests(ITestOutputHelper output)
{
    private sealed class CountingFactory(string directory) : LocalApiFactory(directory)
    {
        public CountingDocumentDatabase Counter => (CountingDocumentDatabase)Services.GetRequiredService<IDocumentDatabase>();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services =>
            {
                var registered = services.Last(d => d.ServiceType == typeof(IDocumentDatabase));
                services.Remove(registered);
                services.AddSingleton<IDocumentDatabase>(provider => new CountingDocumentDatabase(
                    (IDocumentDatabase)registered.ImplementationFactory!(provider)));
            });
        }
    }

    // Through the host's own services (its own document store), as an operator, so the write reaches that host's public read cache.
    private static async Task VerifiedLocatedParishAsync(CountingFactory factory, string admin, int n)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        services.GetRequiredService<IHttpContextAccessor>().HttpContext = new DefaultHttpContext
        {
            RequestServices = services,
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, admin), new Claim("amr", "mfa")], "IsolatedFixture"))
        };
        var service = services.GetRequiredService<ParishService>();
        var parish = await service.RegisterAsync(new RegisterParishDto { OperationId = Guid.NewGuid(), Name = "Cost parish " + n, Locality = "Cost town", Contact = "office@fixture.example" }, default);
        await service.VerifyAsync(parish.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(), Version = (await services.GetRequiredService<IParishRepository>().GetAsync(parish.Id, default))!.Version,
            EvidenceReference = "isolated representative verification"
        }, default);
        await services.GetRequiredService<ParishLocationService>().SetAsync(parish.Id, new SetParishLocationDto
        {
            OperationId = Guid.NewGuid(), Latitude = 33.9m + n / 100m, Longitude = 35.5m, SourceReference = "isolated surveyed coordinates"
        }, default);
        services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
    }

    private async Task<(int Reads, int Queries, int Commits, string Body, string? ETag)> MeasureAsync(CountingFactory factory, HttpClient client, string label, string path)
    {
        factory.Counter.Reset();
        var response = await client.GetAsync(path);
        var body = await response.Content.ReadAsStringAsync();
        var cost = (factory.Counter.Reads, factory.Counter.Queries, factory.Counter.Commits, body, response.Headers.ETag?.Tag);
        Assert.True(response.StatusCode is HttpStatusCode.OK or HttpStatusCode.NotFound, $"{label}: {response.StatusCode} {body}");
        output.WriteLine($"| {label} | {cost.Reads} | {cost.Queries} | {cost.Commits} | {(int)response.StatusCode} |");
        foreach (var repeated in factory.Counter.Log.GroupBy(x => x).Where(g => g.Count() > 1))
            output.WriteLine($"|   repeated {repeated.Count()}x: {repeated.Key} | | | | |");
        return cost;
    }

    [Fact]
    public async Task Main_requests_report_their_document_operation_counts()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        await s.EventAsync(visibility: "Public");
        await using var factory = new CountingFactory(fixture.DirectoryPath);
        using var visitor = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await visitor.GetAsync("/health/live")).StatusCode);
        var p = "/api/public/parishes/" + s.Parish;
        var from = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var to = DateTime.UtcNow.AddDays(6).ToString("yyyy-MM-dd");
        var now = DateTimeOffset.UtcNow;
        var window = $"start={Uri.EscapeDataString(now.ToString("O"))}&end={Uri.EscapeDataString(now.AddDays(30).ToString("O"))}";

        output.WriteLine("| Request | Point reads | Query pages | Commits | Status |");
        output.WriteLine("|---|---|---|---|---|");
        var directoryOne = await MeasureAsync(factory, visitor, "GET /api/public/parishes (1 verified parish)", "/api/public/parishes");
        Assert.Equal((0, 0), Cost(await MeasureAsync(factory, visitor, "GET /api/public/parishes again (server cache)", "/api/public/parishes")));
        await MeasureAsync(factory, visitor, "GET .../profile", p + "/profile");
        await MeasureAsync(factory, visitor, "GET .../website?lang=en", p + "/website?lang=en");
        await MeasureAsync(factory, visitor, "GET .../calendar (30 days)", p + "/calendar?" + window + "&size=50");
        await MeasureAsync(factory, visitor, "GET .../ministries", p + "/ministries?size=50");
        await MeasureAsync(factory, visitor, "GET .../announcements", p + "/announcements");
        await MeasureAsync(factory, visitor, "GET .../liturgical-calendar (7 days)", p + $"/liturgical-calendar?from={from}&to={to}&lang=en");
        await MeasureAsync(factory, visitor, "GET /api/public/homepage?lang=en", "/api/public/homepage?lang=en");
        await MeasureAsync(factory, visitor, "GET /api/auth/csrf (anonymous)", "/api/auth/csrf");

        using var office = factory.Client();
        await AuthHttp.LoginAsync(office, "other@fixture.example");
        await MeasureAsync(factory, office, "GET /api/auth/me (signed in)", "/api/auth/me");
        await MeasureAsync(factory, office, "GET /api/me/parishes", "/api/me/parishes");
        await MeasureAsync(factory, office, "GET /api/me/capacities", "/api/me/capacities");
        await MeasureAsync(factory, office, "GET /api/me/home", "/api/me/home");
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        await MeasureAsync(factory, office, "GET /api/parishes/{id}/calendar/events (staff, 31 days)", $"/api/parishes/{s.Parish}/calendar/events?{window}");
        await MeasureAsync(factory, office, "GET /api/parishes/{id}/facilities (staff)", $"/api/parishes/{s.Parish}/facilities");

        // Signing in wrote sessions to the Accounts container: public answers stay cached.
        Assert.Equal((0, 0), Cost(await MeasureAsync(factory, visitor, "GET /api/public/parishes again after sign-ins (server cache)", "/api/public/parishes")));

        for (var n = 0; n < 10; n++)
            await VerifiedLocatedParishAsync(factory, fixture.FirstAdmin, n);
        var directoryEleven = await MeasureAsync(factory, visitor, "GET /api/public/parishes (11 verified parishes, after the writes)", "/api/public/parishes");
        Assert.Contains("Cost parish 9", directoryEleven.Body); // the parish writes cleared the cached directory at once
        output.WriteLine($"Directory growth for 10 more parishes: {directoryEleven.Reads - directoryOne.Reads} point reads, {directoryEleven.Queries - directoryOne.Queries} query pages.");
        var cached = await MeasureAsync(factory, visitor, "GET /api/public/parishes again (server cache)", "/api/public/parishes");
        Assert.Equal((0, 0), Cost(cached));
        Assert.Equal((directoryEleven.Body, directoryEleven.ETag), (cached.Body, cached.ETag)); // the same bytes and validator as computed
        visitor.DefaultRequestHeaders.IfNoneMatch.Add(new EntityTagHeaderValue(cached.ETag!));
        var revalidated = await visitor.GetAsync("/api/public/parishes");
        Assert.Equal((HttpStatusCode.NotModified, "public, max-age=300"), (revalidated.StatusCode, revalidated.Headers.CacheControl?.ToString()));
    }

    [Fact]
    public async Task Directory_documents_of_every_parish_come_back_in_one_query_keyed_by_their_partition()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        await using var factory = new CountingFactory(fixture.DirectoryPath);
        for (var n = 0; n < 3; n++)
            await VerifiedLocatedParishAsync(factory, fixture.FirstAdmin, n);
        await using var scope = factory.Services.CreateAsyncScope();
        var directory = scope.ServiceProvider.GetRequiredService<IParishDirectory>();
        factory.Counter.Reset();
        var locations = await directory.ByParishAsync<ParishLocation>("parishLocation", default);
        Assert.Equal((0, 1), (factory.Counter.Reads, factory.Counter.Queries));
        Assert.Equal(3, locations.Count);
        Assert.All(locations, pair => Assert.Equal(pair.Key, pair.Value.ParishId));
        // Only the public directory's own types: nothing else is read across parishes.
        await Assert.ThrowsAsync<InvalidOperationException>(() => directory.ByParishAsync<Person>("person", default));
    }

    private static (int, int) Cost((int Reads, int Queries, int Commits, string Body, string? ETag) cost) => (cost.Reads, cost.Queries);
}
