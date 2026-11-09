// Purpose: proves real ministry meeting room requests use the existing allocation worker while preserving source, privacy and current group authority.
// Main tests: pending booking gates meeting confirmation/cancellation; ministry closure compensates allocation and unrelated facility grants cannot authorize it.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryReservationTests
{
    [Fact]
    public async Task Meeting_room_work_preserves_one_occurrence_and_waits_for_actual_allocation_and_release()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); s.Use();
        var meetings = f.Services.GetRequiredService<MinistryMeetingService>();
        var reservations = f.Services.GetRequiredService<ReservationService>();
        var meeting = await meetings.SaveAsync(s.Parish, group.Id, null, Draft(f), default);
        var room = await f.Services.GetRequiredService<FacilityService>().SaveAsync(s.Parish, null,
            new SaveFacilityDto { OperationId = Guid.NewGuid(), Name = "Isolated meeting room", Kind = "Room", Capacity = 30 }, default);
        var booking = await reservations.RequestAsync(s.Parish, new ReserveDto
        { OperationId = Guid.NewGuid(), EventId = Guid.Parse(meeting.EventId), ResourceId = Guid.Parse(room.Id), StartsAt = meeting.StartsAt, EndsAt = meeting.EndsAt }, default);
        var row = await meetings.GetAsync(s.Parish, group.Id, meeting.Id, default);
        var edit = Draft(f); edit.Version = row.Version;
        await Assert.ThrowsAsync<DomainException>(() => meetings.SaveAsync(s.Parish, group.Id, meeting.Id, edit, default));
        await Assert.ThrowsAsync<DomainException>(() => meetings.ActAsync(s.Parish, group.Id, meeting.Id,
            new MinistryMeetingActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "confirm" }, default));
        var pending = await reservations.ActAsync(s.Parish, booking.Id, new ReservationActionDto
        { OperationId = Guid.NewGuid(), Version = (await reservations.GetAsync(s.Parish, booking.Id, default)).Version, Action = "confirm", Reason = "Actual isolated allocation decision" }, default);
        Assert.Equal("Allocating", pending.Status);
        await f.Services.GetRequiredService<ReservationProcessor>().ProcessOneAsync(s.Parish, pending.CurrentWorkId!, "isolated-ministry-worker", default);
        Assert.Equal("Confirmed", (await reservations.GetAsync(s.Parish, booking.Id, default)).Value.Status);
        row = await meetings.GetAsync(s.Parish, group.Id, meeting.Id, default);
        await meetings.ActAsync(s.Parish, group.Id, meeting.Id,
            new MinistryMeetingActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "confirm" }, default);
        var calendar = f.Services.GetRequiredService<CalendarService>();
        var busy = await calendar.GetAsync(s.Parish, meeting.EventId, default);
        Assert.True(busy.Value.Redacted); Assert.Equal("Busy", busy.Value.Title);
        Assert.Empty((await calendar.PublicAsync(s.Parish, meeting.StartsAt.AddHours(-1), meeting.EndsAt.AddHours(1), 25, null, default)).Items);
        await Assert.ThrowsAsync<DomainException>(() => calendar.ActAsync(s.Parish, meeting.EventId,
            new EventActionDto { OperationId = Guid.NewGuid(), Version = "unused", Action = "cancel", Reason = "must use owning workflow" }, default));
        row = await meetings.GetAsync(s.Parish, group.Id, meeting.Id, default);
        await Assert.ThrowsAsync<DomainException>(() => meetings.ActAsync(s.Parish, group.Id, meeting.Id,
            new MinistryMeetingActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "cancel", Reason = "wait for actual release" }, default));
        var cancelling = await reservations.ActAsync(s.Parish, booking.Id, new ReservationActionDto
        { OperationId = Guid.NewGuid(), Version = (await reservations.GetAsync(s.Parish, booking.Id, default)).Version, Action = "cancel", Reason = "Release actual room" }, default);
        Assert.Equal("Cancelling", cancelling.Status);
        await f.Services.GetRequiredService<ReservationProcessor>().ProcessOneAsync(s.Parish, cancelling.CurrentWorkId!, "isolated-ministry-worker", default);
        row = await meetings.GetAsync(s.Parish, group.Id, meeting.Id, default);
        Assert.Equal("Cancelled", (await meetings.ActAsync(s.Parish, group.Id, meeting.Id,
            new MinistryMeetingActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "cancel", Reason = "Actual group cancellation" }, default)).Status);
    }

    [Fact]
    public async Task Facility_authority_alone_cannot_operate_group_booking_and_closed_group_never_confirms_queued_work()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); s.Use();
        var meeting = await f.Services.GetRequiredService<MinistryMeetingService>().SaveAsync(s.Parish, group.Id, null, Draft(f), default);
        var room = await f.Services.GetRequiredService<FacilityService>().SaveAsync(s.Parish, null,
            new SaveFacilityDto { OperationId = Guid.NewGuid(), Name = "Isolated room", Kind = "Room", Capacity = 10 }, default);
        var reservations = f.Services.GetRequiredService<ReservationService>();
        var request = new ReserveDto { OperationId = Guid.NewGuid(), EventId = Guid.Parse(meeting.EventId), ResourceId = Guid.Parse(room.Id), StartsAt = meeting.StartsAt, EndsAt = meeting.EndsAt };
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => reservations.RequestAsync(s.Parish, request, default));
        s.Use(); var booking = await reservations.RequestAsync(s.Parish, request, default);
        var pending = await reservations.ActAsync(s.Parish, booking.Id, new ReservationActionDto
        { OperationId = Guid.NewGuid(), Version = (await reservations.GetAsync(s.Parish, booking.Id, default)).Version, Action = "confirm", Reason = "Group booking reviewed" }, default);
        await s.ActAsync(group.Id, "archive"); s.Use();
        await f.Services.GetRequiredService<ReservationProcessor>().ProcessOneAsync(s.Parish, pending.CurrentWorkId!, "isolated-revoked-group-worker", default);
        var failed = (await reservations.GetAsync(s.Parish, booking.Id, default)).Value;
        Assert.Equal("Conflict", failed.Status); Assert.Equal("authorization_changed", failed.ErrorCode);
        f.As(f.FirstAdmin);
        Assert.True((await reservations.GetAsync(s.Parish, booking.Id, default)).Value.Redacted);
    }

    private static SaveMinistryMeetingDto Draft(LocalBackendFixture f) => new()
    { OperationId = Guid.NewGuid(), Title = "Private isolated meeting", Agenda = "Group-only agenda", StartsAt = f.Clock.Now.AddDays(1), EndsAt = f.Clock.Now.AddDays(1).AddHours(1), TimeZone = "UTC" };
    private static async Task<MinistryScenario> Scenario(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "ministries", "facilities"]);
        var priest = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows:
            [Permissions.MinistriesManage, Permissions.PeopleWrite, Permissions.PeopleRead, Permissions.PublishingManage, Permissions.FacilitiesManage, Permissions.ScheduleRead, Permissions.ScheduleManage]));
        return new MinistryScenario(staff, priest.Id);
    }
}
