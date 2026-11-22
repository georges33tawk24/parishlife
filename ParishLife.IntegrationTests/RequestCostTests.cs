// Purpose: measures how many document operations (point reads, query pages, commits) the main public and signed-in HTTP requests make,
// through a counting decorator around the real local store, and prints a table for the performance report (Agent 04).
// Main test: Main_requests_report_their_document_operation_counts; helpers create verified parishes with recorded locations and send
// one measured request each.

using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Organizations;
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

    private static async Task VerifiedLocatedParishAsync(LocalBackendFixture f, int n)
    {
        f.As(f.FirstAdmin);
        var service = f.Services.GetRequiredService<ParishService>();
        var parish = await service.RegisterAsync(new RegisterParishDto { OperationId = Guid.NewGuid(), Name = "Cost parish " + n, Locality = "Cost town", Contact = "office@fixture.example" }, default);
        await service.VerifyAsync(parish.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(), Version = (await f.Services.GetRequiredService<IParishRepository>().GetAsync(parish.Id, default))!.Version,
            EvidenceReference = "isolated representative verification"
        }, default);
        await f.Services.GetRequiredService<ParishLocationService>().SetAsync(parish.Id, new SetParishLocationDto
        {
            OperationId = Guid.NewGuid(), Latitude = 33.9m + n / 100m, Longitude = 35.5m, SourceReference = "isolated surveyed coordinates"
        }, default);
    }

    private async Task<(int Reads, int Queries, int Commits)> MeasureAsync(CountingFactory factory, HttpClient client, string label, string path)
    {
        factory.Counter.Reset();
        var response = await client.GetAsync(path);
        var cost = (factory.Counter.Reads, factory.Counter.Queries, factory.Counter.Commits);
        Assert.True(response.StatusCode is HttpStatusCode.OK or HttpStatusCode.NotFound, $"{label}: {response.StatusCode} {await response.Content.ReadAsStringAsync()}");
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

        for (var n = 0; n < 10; n++)
            await VerifiedLocatedParishAsync(fixture, n);
        var directoryEleven = await MeasureAsync(factory, visitor, "GET /api/public/parishes (11 verified parishes)", "/api/public/parishes");
        output.WriteLine($"Directory growth for 10 more parishes: {directoryEleven.Reads - directoryOne.Reads} point reads, {directoryEleven.Queries - directoryOne.Queries} query pages.");
    }
}
