// Purpose: exercises real cookie/MFA/CSRF calendar and room booking endpoints with actual persisted worker completion and an anonymous public projection.
// Main test: Booking_stays_pending_until_processed_and_calendar_is_public_only_after_explicit_publication; helpers authenticate and read typed responses.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CalendarReservationHttpTests
{
    [Fact]
    public async Task Running_host_resumes_the_actual_queued_booking_when_background_processing_is_enabled()
    {
        await using var fixture = new LocalBackendFixture(); fixture.Clock.Now = DateTimeOffset.UtcNow; await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var room = await s.FacilityAsync();
        var pending = await s.ActAsync((await s.RequestAsync(await s.EventAsync(), room.Id)).Id, "confirm");
        await using var factory = new LocalApiFactory(fixture.DirectoryPath, runJobs: true);
        using var client = factory.Client();
        var deadline = DateTimeOffset.UtcNow.AddSeconds(20);
        string? state = null;
        while (DateTimeOffset.UtcNow < deadline)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var row = await scope.ServiceProvider.GetRequiredService<IRecordTransactions>().ReadAsync<Reservation>(SchedulingScope.For(s.Parish), "reservation:" + pending.Id, default);
            state = row?.Value.Status;
            if (state is "Confirmed" or "Conflict") break;
            await Task.Delay(100);
        }
        Assert.Equal("Confirmed", state);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
    }

    [Fact]
    public async Task Booking_stays_pending_until_processed_and_calendar_is_public_only_after_explicit_publication()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var office = factory.Client();
        using var visitor = factory.Client();
        var root = $"/api/parishes/{s.Parish}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(root + "/facilities")).StatusCode);
        await Csrf(office);
        var pending = await Read<JsonElement>(await office.PostAsJsonAsync("/api/auth/login", new { username = "other@fixture.example", password = "isolated-fixture-long-password" }));
        var challenge = pending.GetProperty("challenge");
        await Read<JsonElement>(await office.PostAsJsonAsync("/api/auth/login/mfa", new { accountId = challenge.GetProperty("accountId").GetString(), challenge = challenge.GetProperty("challenge").GetString(), code = TestAuthenticator.Code() }));
        await Csrf(office);
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        var room = await Read<FacilityDto>(await office.PostAsJsonAsync(root + "/facilities", new SaveFacilityDto { OperationId = Guid.NewGuid(), Name = "Isolated HTTP room", Kind = "Room", Capacity = 30, SetupMinutes = 15, CleanupMinutes = 15 }));
        var when = DateTimeOffset.UtcNow.AddDays(1);
        var occurrence = await Read<CalendarEventDto>(await office.PostAsJsonAsync(root + "/calendar/events", new SaveEventDto
        {
            OperationId = Guid.NewGuid(),
            Title = "Isolated HTTP activity",
            Kind = "ParishActivity",
            StartsAt = when,
            EndsAt = when.AddHours(1),
            TimeZone = "UTC",
            Visibility = "Public",
            Description = "Approved isolated public details"
        }));
        var booking = await Read<ReservationDto>(await office.PostAsJsonAsync(root + "/reservations", new ReserveDto { OperationId = Guid.NewGuid(), ResourceId = Guid.Parse(room.Id), EventId = Guid.Parse(occurrence.Id), StartsAt = occurrence.StartsAt, EndsAt = occurrence.EndsAt }));
        var path = root + "/reservations/" + booking.Id;
        var current = await Read<Versioned<ReservationDto>>(await office.GetAsync(path));
        var action = new ReservationActionDto { OperationId = Guid.NewGuid(), Version = current.Version, Action = "confirm", Reason = "Isolated real HTTP decision" };
        office.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await office.PostAsJsonAsync(path + "/actions", action)).StatusCode);
        await Csrf(office);
        var response = await office.PostAsJsonAsync(path + "/actions", action);
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var allocating = await Read<ReservationDto>(response);
        Assert.Equal("Allocating", allocating.Status);
        var eventPath = root + "/calendar/events/" + occurrence.Id;
        var eventRow = await Read<Versioned<CalendarEventDto>>(await office.GetAsync(eventPath));
        Assert.Equal(HttpStatusCode.Conflict, (await office.PostAsJsonAsync(eventPath + "/actions", new EventActionDto { OperationId = Guid.NewGuid(), Version = eventRow.Version, Action = "confirm" })).StatusCode);
        await using (var scope = factory.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<ReservationProcessor>().ProcessOneAsync(s.Parish, allocating.CurrentWorkId!, "isolated-http-worker", default);
        Assert.Equal("Confirmed", (await Read<Versioned<ReservationDto>>(await office.GetAsync(path))).Value.Status);
        eventRow = await Read<Versioned<CalendarEventDto>>(await office.GetAsync(eventPath));
        await Read<CalendarEventDto>(await office.PostAsJsonAsync(eventPath + "/actions", new EventActionDto { OperationId = Guid.NewGuid(), Version = eventRow.Version, Action = "confirm" }));
        var query = $"?start={Uri.EscapeDataString(when.AddHours(-1).ToString("O"))}&end={Uri.EscapeDataString(when.AddHours(2).ToString("O"))}";
        var publicPath = $"/api/public/parishes/{s.Parish}/calendar" + query;
        Assert.Empty((await Read<Page<PublicCalendarEventDto>>(await visitor.GetAsync(publicPath))).Items);
        eventRow = await Read<Versioned<CalendarEventDto>>(await office.GetAsync(eventPath));
        await Read<CalendarEventDto>(await office.PostAsJsonAsync(eventPath + "/actions", new EventActionDto { OperationId = Guid.NewGuid(), Version = eventRow.Version, Action = "publish" }));
        var publicResponse = await visitor.GetAsync(publicPath);
        var json = await publicResponse.Content.ReadAsStringAsync();
        Assert.Equal("Confirmed", Assert.Single((await Read<Page<PublicCalendarEventDto>>(publicResponse)).Items).Status);
        Assert.DoesNotContain("createdBy", json);
        Assert.DoesNotContain("customerId", json);
        Assert.DoesNotContain(fixture.Other, json);
        var openApi = await Read<JsonElement>(await office.GetAsync("/openapi/v1.json"));
        var schemas = openApi.GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.TryGetProperty("ReservationDto", out _));
        Assert.True(schemas.TryGetProperty("CalendarEventDto", out _));
        Assert.False(schemas.TryGetProperty("ReservationWork", out _));
        Assert.False(schemas.TryGetProperty("ResourceAllocation", out _));
    }
    private static async Task Csrf(HttpClient client)
    {
        var result = await Read<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", result.GetProperty("token").GetString());
    }
    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
