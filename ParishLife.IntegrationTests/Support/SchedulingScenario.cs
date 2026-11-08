// Purpose: prepares actual paid scheduling scope and accepted priest capacity in an isolated local backend.
// Main functions: CreateAsync, Use, EventAsync, FacilityAsync, RequestAsync and ActAsync exercise real services and versions rather than seeding business records.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.IntegrationTests.Support;

internal class SchedulingScenario(StaffAppointmentScenario staff, string appointment)
{
    internal StaffAppointmentScenario Staff { get; } = staff;
    internal LocalBackendFixture Fixture => Staff.Fixture;
    internal string Parish => Staff.Parish;
    internal string Appointment { get; } = appointment;
    internal CalendarService Calendar => Fixture.Services.GetRequiredService<CalendarService>();
    internal FacilityService Facilities => Fixture.Services.GetRequiredService<FacilityService>();
    internal ReservationService Reservations => Fixture.Services.GetRequiredService<ReservationService>();
    internal ReservationProcessor Processor => Fixture.Services.GetRequiredService<ReservationProcessor>();
    internal static async Task<SchedulingScenario> CreateAsync(LocalBackendFixture fixture)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(fixture);
        await staff.ActivateOfficeAsync(["core", "office", "facilities"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(fixture.Other,
            allows: [Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.SchedulePublish, Permissions.FacilitiesManage]));
        return new SchedulingScenario(staff, appointment.Id);
    }
    internal void Use() => Fixture.AsAppointment(Fixture.Other, Appointment);
    internal async Task<CalendarEventDto> EventAsync(DateTimeOffset? start = null, string visibility = "Parish", string title = "Isolated activity")
    {
        Use();
        var when = start ?? Fixture.Clock.Now.AddDays(1);
        return await Calendar.SaveAsync(Parish, null, new SaveEventDto
        {
            OperationId = Guid.NewGuid(),
            Title = title,
            Kind = "ParishActivity",
            StartsAt = when,
            EndsAt = when.AddHours(1),
            TimeZone = "UTC",
            Visibility = visibility,
            Description = "Isolated details"
        }, default);
    }
    internal async Task<FacilityDto> FacilityAsync(int setup = 0, int cleanup = 0, string[]? exclusions = null)
    {
        Use();
        return await Facilities.SaveAsync(Parish, null, new SaveFacilityDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated room",
            Kind = "Room",
            Capacity = 20,
            SetupMinutes = setup,
            CleanupMinutes = cleanup,
            ExclusionResourceIds = exclusions?.Select(Guid.Parse).ToArray() ?? []
        }, default);
    }
    internal async Task<ReservationDto> RequestAsync(CalendarEventDto occurrence, params string[] resources)
    {
        Use();
        return await Reservations.RequestAsync(Parish, new ReserveDto
        {
            OperationId = Guid.NewGuid(),
            EventId = Guid.Parse(occurrence.Id),
            ResourceId = Guid.Parse(resources[0]),
            StartsAt = occurrence.StartsAt,
            EndsAt = occurrence.EndsAt,
            AdditionalResourceIds = resources.Skip(1).Select(Guid.Parse).ToArray(),
            TermsSnapshot = "isolated actual terms"
        }, default);
    }
    internal async Task<ReservationDto> ActAsync(string id, string action)
    {
        Use();
        var row = await Reservations.GetAsync(Parish, id, default);
        return await Reservations.ActAsync(Parish, id, new ReservationActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = action, Reason = "Isolated office decision" }, default);
    }
    internal async Task<CalendarEventDto> EventActionAsync(string id, string action)
    {
        Use();
        var row = await Calendar.GetAsync(Parish, id, default);
        return await Calendar.ActAsync(Parish, id, new EventActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = action, Reason = "Isolated calendar decision" }, default);
    }
}
