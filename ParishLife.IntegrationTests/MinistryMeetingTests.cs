// Purpose: verifies source-owned ministry meetings, current group audiences and RSVP through real services, storage and HTTP.
// Main tests: atomic source lifecycle/stale rollback, no inferred attendance, deadline and membership boundaries,
// cleanup after coverage lapse, current appointment revocation, actual room allocation, and cookie/MFA/CSRF/recovery boundaries.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryMeetingTests
{
    [Fact]
    public async Task Meeting_and_source_calendar_change_atomically_and_manual_routes_cannot_override_the_owner()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync();
        var service = Meetings(f); s.Use();
        var request = Draft(f);
        var meeting = await service.SaveAsync(s.Parish, group.Id, null, request, default);
        var source = await Event(f, s.Parish, meeting.EventId);
        Assert.Equal("MinistryMeeting", source.Value.SourceType);
        Assert.Equal(meeting.Id, source.Value.SourceId);
        Assert.Equal(group.Id, source.Value.MinistryId);
        Assert.Equal(meeting.StartsAt, source.Value.StartsAt);
        Assert.Equal("Ministry", source.Value.Visibility);
        Assert.False(source.Value.Published);
        Assert.Null(source.Value.Description);
        var failed = Draft(f); failed.Version = "stale"; failed.Title = "Must not reach either document";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Parish, group.Id, meeting.Id, failed, default))).Code);
        Assert.Equal(meeting.Title, (await service.GetAsync(s.Parish, group.Id, meeting.Id, default)).Value.Title);
        Assert.Equal(source.Version, (await Event(f, s.Parish, meeting.EventId)).Version);
        var edit = Draft(f); edit.Version = (await service.GetAsync(s.Parish, group.Id, meeting.Id, default)).Version;
        edit.Title = "Corrected isolated meeting"; edit.StartsAt = edit.StartsAt.AddHours(1); edit.EndsAt = edit.EndsAt.AddHours(1);
        var updated = await service.SaveAsync(s.Parish, group.Id, meeting.Id, edit, default);
        Assert.Equal(updated.StartsAt, (await Event(f, s.Parish, meeting.EventId)).Value.StartsAt);
        await Act(s, group.Id, meeting.Id, "confirm");
        s.Use();
        Assert.Equal("Confirmed", (await service.SaveAsync(s.Parish, group.Id, null, request, default)).Status);
        Assert.Single(await Records(f).CollectAsync<MinistryMeeting>(MinistryAccess.Scope(s.Parish), "ministryMeeting", default));
        f.As(f.FirstAdmin);
        var calendar = f.Services.GetRequiredService<CalendarService>();
        var busy = await calendar.GetAsync(s.Parish, meeting.EventId, default);
        Assert.True(busy.Value.Redacted); Assert.Equal("Busy", busy.Value.Title); Assert.Equal(string.Empty, busy.Version);
        Assert.Null(busy.Value.Description);
        var actual = await Event(f, s.Parish, meeting.EventId);
        Assert.Equal("source_command_required", (await Assert.ThrowsAsync<DomainException>(() => calendar.ActAsync(s.Parish, meeting.EventId,
            new EventActionDto { OperationId = Guid.NewGuid(), Version = actual.Version, Action = "cancel", Reason = "must use meeting owner" }, default))).Code);
        Assert.Empty((await calendar.PublicAsync(s.Parish, updated.StartsAt.AddHours(-1), updated.EndsAt.AddHours(1), 25, null, default)).Items);
        Assert.Equal("Confirmed", (await Event(f, s.Parish, meeting.EventId)).Value.Status);
    }

    [Fact]
    public async Task Only_current_group_members_see_future_confirmed_meetings_and_RSVP_never_creates_attendance()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync();
        var member = await Join(s, group.Id); var stranger = await s.LinkedApplicantAsync();
        s.Use(); var service = Meetings(f); var meeting = await service.SaveAsync(s.Parish, group.Id, null, Draft(f), default);
        f.As(member.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Parish, group.Id, meeting.Id, default));
        await Act(s, group.Id, meeting.Id, "confirm");
        f.As(stranger.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Parish, group.Id, meeting.Id, default));
        f.As(member.AccountId, false);
        var view = await service.GetAsync(s.Parish, group.Id, meeting.Id, default);
        Assert.Equal(string.Empty, view.Version); Assert.Equal("Isolated group agenda", view.Value.Agenda);
        Assert.Null(view.Value.RsvpPolicyReference);
        var none = await service.OwnRsvpAsync(s.Parish, group.Id, meeting.Id, default);
        Assert.False(none.Value.Recorded); Assert.Null(none.Value.Response); Assert.Null(none.Value.RespondedAt);
        var reply = new RsvpDto { OperationId = Guid.NewGuid(), Response = "Yes" };
        Assert.Equal("Yes", (await service.RsvpAsync(s.Parish, group.Id, meeting.Id, reply, default)).Response);
        var row = await service.OwnRsvpAsync(s.Parish, group.Id, meeting.Id, default);
        Assert.Equal("No", (await service.RsvpAsync(s.Parish, group.Id, meeting.Id,
            new RsvpDto { OperationId = Guid.NewGuid(), Version = row.Version, Response = "No" }, default)).Response);
        Assert.Equal("No", (await service.RsvpAsync(s.Parish, group.Id, meeting.Id, reply, default)).Response);
        await Assert.ThrowsAsync<DomainException>(() => service.RsvpAsync(s.Parish, group.Id, meeting.Id,
            new RsvpDto { OperationId = Guid.NewGuid(), Version = row.Version, Response = "Undecided" }, default));
        await Assert.ThrowsAsync<DomainException>(() => service.RsvpsAsync(s.Parish, group.Id, meeting.Id, 25, null, default));
        f.AsAppointment(member.AccountId, s.Appointment);
        await Assert.ThrowsAsync<DomainException>(() => service.OwnRsvpAsync(s.Parish, group.Id, meeting.Id, default));
        s.Use();
        var replies = await service.RsvpsAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        Assert.Equal("No", Assert.Single(replies.Items).Response);
        Assert.Empty(await Records(f).CollectAsync<AttendanceRecord>(MinistryAccess.Scope(s.Parish), "attendance", default));
        var stored = await Records(f).ReadAsync<MinistryMeeting>(MinistryAccess.Scope(s.Parish), "ministryMeeting:" + meeting.Id, default);
        Assert.Empty(stored!.Value.ExpectedPersonIds);
    }

    [Fact]
    public async Task RSVP_cutoffs_and_modes_are_explicit_and_expired_replay_does_not_change_the_recorded_reply()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await Join(s, group.Id);
        var service = Meetings(f); s.Use();
        var invalid = Draft(f); invalid.RsvpMode = "Required";
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Parish, group.Id, null, invalid, default));
        invalid = Draft(f); invalid.RsvpDeadline = invalid.StartsAt.AddSeconds(1);
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Parish, group.Id, null, invalid, default));
        var request = Draft(f); request.RsvpDeadline = f.Clock.Now.AddMinutes(30);
        var meeting = await service.SaveAsync(s.Parish, group.Id, null, request, default);
        await Act(s, group.Id, meeting.Id, "confirm");
        f.As(member.AccountId, false);
        var reply = new RsvpDto { OperationId = Guid.NewGuid(), Response = "Undecided" };
        await service.RsvpAsync(s.Parish, group.Id, meeting.Id, reply, default);
        f.Clock.Now = request.RsvpDeadline.Value;
        var saved = await service.OwnRsvpAsync(s.Parish, group.Id, meeting.Id, default);
        Assert.False(saved.Value.CanChange);
        await Assert.ThrowsAsync<DomainException>(() => service.RsvpAsync(s.Parish, group.Id, meeting.Id,
            new RsvpDto { OperationId = Guid.NewGuid(), Version = saved.Version, Response = "Yes" }, default));
        Assert.Equal("Undecided", (await service.RsvpAsync(s.Parish, group.Id, meeting.Id, reply, default)).Response);
        s.Use(); var disabledRequest = Draft(f); disabledRequest.RsvpMode = "NotRequested";
        var disabled = await service.SaveAsync(s.Parish, group.Id, null, disabledRequest, default);
        await Act(s, group.Id, disabled.Id, "confirm");
        f.As(member.AccountId, false);
        Assert.Null((await service.GetAsync(s.Parish, group.Id, disabled.Id, default)).Value.RsvpDeadline);
        await Assert.ThrowsAsync<DomainException>(() => service.RsvpAsync(s.Parish, group.Id, disabled.Id,
            new RsvpDto { OperationId = Guid.NewGuid(), Response = "Yes" }, default));
    }

    [Fact]
    public async Task Departure_and_historical_time_end_member_access_without_erasing_operator_history()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await Join(s, group.Id);
        var service = Meetings(f); s.Use(); var meeting = await service.SaveAsync(s.Parish, group.Id, null, Draft(f), default);
        await Act(s, group.Id, meeting.Id, "confirm");
        var leave = await s.ApplyAsync(group.Id, member.AccountId, "Leave");
        await s.ApplicationActionAsync(group.Id, leave.Id, "approve");
        f.As(member.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Parish, group.Id, meeting.Id, default));
        var newcomer = await Join(s, group.Id);
        f.Clock.Now = meeting.StartsAt.AddHours(2);
        f.As(newcomer.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Parish, group.Id, meeting.Id, default));
        Assert.Empty((await service.ListAsync(s.Parish, group.Id, meeting.StartsAt.AddHours(-1), meeting.EndsAt.AddHours(1), 25, null, default)).Items);
        s.Use();
        Assert.Equal(meeting.Id, (await service.GetAsync(s.Parish, group.Id, meeting.Id, default)).Value.Id);
        Assert.Contains((await service.HistoryAsync(s.Parish, group.Id, meeting.Id, 25, null, default)).Items, row => row.Action == "confirm");
        await Assert.ThrowsAsync<DomainException>(() => Act(s, group.Id, meeting.Id, "cancel"));
    }

    [Fact]
    public async Task Coverage_lapse_keeps_authorized_reads_and_cancellation_but_stops_new_meetings_and_replies()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await Join(s, group.Id);
        var leader = await f.CreateVerifiedStaffAsync();
        s.Use();
        await f.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, group.Id, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, group.Id, default)).Version,
            AccountId = Guid.Parse(leader), Role = "Leader", StartsAt = f.Clock.Now, EvidenceReference = "isolated reviewed long-term leadership"
        }, default);
        var service = Meetings(f); var request = Draft(f); request.StartsAt = f.Clock.Now.AddDays(60); request.EndsAt = request.StartsAt.AddHours(1);
        var meeting = await service.SaveAsync(s.Parish, group.Id, null, request, default);
        await Act(s, group.Id, meeting.Id, "confirm");
        f.Clock.Now = f.Clock.Now.AddDays(32);
        f.As(member.AccountId, false);
        Assert.False((await service.GetAsync(s.Parish, group.Id, meeting.Id, default)).Value.RsvpOpen);
        Assert.False((await service.OwnRsvpAsync(s.Parish, group.Id, meeting.Id, default)).Value.CanChange);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => service.RsvpAsync(s.Parish, group.Id, meeting.Id,
            new RsvpDto { OperationId = Guid.NewGuid(), Response = "Yes" }, default))).Code);
        f.As(leader);
        var row = await service.GetAsync(s.Parish, group.Id, meeting.Id, default);
        Assert.False(row.Value.RsvpOpen);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Parish, group.Id, null, Draft(f), default))).Code);
        var cancelled = await service.ActAsync(s.Parish, group.Id, meeting.Id, new MinistryMeetingActionDto
        { OperationId = Guid.NewGuid(), Version = row.Version, Action = "cancel", Reason = "Isolated cleanup after lapse" }, default);
        Assert.Equal("Cancelled", cancelled.Status);
        Assert.Equal("Cancelled", (await Event(f, s.Parish, meeting.EventId)).Value.Status);
    }

    [Fact]
    public async Task Meeting_confirmation_waits_for_actual_room_allocation_and_cancellation_waits_for_release()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "ministries", "facilities"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows:
            [Permissions.MinistriesManage, Permissions.PeopleWrite, Permissions.PeopleRead, Permissions.PublishingManage,
                Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.FacilitiesManage]));
        var s = new MinistryScenario(staff, appointment.Id); var group = await s.MinistryAsync(); s.Use();
        var service = Meetings(f); var meeting = await service.SaveAsync(s.Parish, group.Id, null, Draft(f), default);
        var facility = await f.Services.GetRequiredService<FacilityService>().SaveAsync(s.Parish, null,
            new SaveFacilityDto { OperationId = Guid.NewGuid(), Name = "Isolated meeting room", Kind = "Room", Capacity = 10 }, default);
        var reservations = f.Services.GetRequiredService<ReservationService>();
        var booking = await reservations.RequestAsync(s.Parish, new ReserveDto
        {
            OperationId = Guid.NewGuid(), EventId = Guid.Parse(meeting.EventId), ResourceId = Guid.Parse(facility.Id),
            StartsAt = meeting.StartsAt, EndsAt = meeting.EndsAt
        }, default);
        await Assert.ThrowsAsync<DomainException>(() => Act(s, group.Id, meeting.Id, "confirm"));
        s.Use(); var bookingRow = await reservations.GetAsync(s.Parish, booking.Id, default);
        var queued = await reservations.ActAsync(s.Parish, booking.Id, new ReservationActionDto
        { OperationId = Guid.NewGuid(), Version = bookingRow.Version, Action = "confirm", Reason = "Isolated actual room decision" }, default);
        Assert.Equal("Allocating", queued.Status);
        await f.Services.GetRequiredService<ReservationProcessor>().ProcessOneAsync(s.Parish, queued.CurrentWorkId!, "isolated-meeting-worker", default);
        Assert.Equal("Confirmed", (await reservations.GetAsync(s.Parish, booking.Id, default)).Value.Status);
        Assert.Equal("Confirmed", (await Act(s, group.Id, meeting.Id, "confirm")).Status);
        await Assert.ThrowsAsync<DomainException>(() => Act(s, group.Id, meeting.Id, "cancel"));
        s.Use(); bookingRow = await reservations.GetAsync(s.Parish, booking.Id, default);
        var cancelling = await reservations.ActAsync(s.Parish, booking.Id, new ReservationActionDto
        { OperationId = Guid.NewGuid(), Version = bookingRow.Version, Action = "cancel", Reason = "Isolated actual room release" }, default);
        Assert.Equal("Cancelling", cancelling.Status);
        await Assert.ThrowsAsync<DomainException>(() => Act(s, group.Id, meeting.Id, "cancel"));
        await f.Services.GetRequiredService<ReservationProcessor>().ProcessOneAsync(s.Parish, cancelling.CurrentWorkId!, "isolated-meeting-worker", default);
        Assert.Equal("Cancelled", (await Act(s, group.Id, meeting.Id, "cancel")).Status);
    }

    [Fact]
    public async Task Actual_HTTP_meeting_and_own_RSVP_require_cookie_MFA_scope_and_CSRF_and_expose_typed_contracts()
    {
        await using var f = new LocalBackendFixture(); f.Clock.Now = DateTimeOffset.UtcNow; await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await Join(s, group.Id);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var priest = factory.Client(); using var applicant = factory.Client(); using var visitor = factory.Client();
        await Login(priest, "other@fixture.example", true); priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        await Login(applicant, member.Username, false);
        var root = $"/api/parishes/{s.Parish}/ministries/{group.Id}/meetings";
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(root + "?start=" + Uri.EscapeDataString(f.Clock.Now.ToString("O"))
            + "&end=" + Uri.EscapeDataString(f.Clock.Now.AddDays(2).ToString("O")))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.PostAsJsonAsync(root, new SaveMinistryMeetingDto
        {
            OperationId = Guid.Empty,
            Title = "",
            StartsAt = f.Clock.Now.AddDays(1),
            EndsAt = f.Clock.Now.AddDays(1).AddHours(1),
            TimeZone = "UTC"
        })).StatusCode);
        var meeting = await Read<MinistryMeetingDto>(await priest.PostAsJsonAsync(root, Draft(f)));
        var path = root + "/" + meeting.Id;
        Assert.False((await applicant.GetAsync(path)).IsSuccessStatusCode);
        var row = await Read<Versioned<MinistryMeetingDto>>(await priest.GetAsync(path));
        await Read<MinistryMeetingDto>(await priest.PostAsJsonAsync(path + "/actions", new MinistryMeetingActionDto
        { OperationId = Guid.NewGuid(), Version = row.Version, Action = "confirm" }));
        var read = await Read<Versioned<MinistryMeetingDto>>(await applicant.GetAsync(path));
        Assert.Equal("Ministry", read.Value.Visibility); Assert.Empty(read.Version);
        applicant.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        var request = new RsvpDto { OperationId = Guid.NewGuid(), Response = "Yes" };
        Assert.Equal(HttpStatusCode.BadRequest, (await applicant.PutAsJsonAsync(path + "/rsvp", request)).StatusCode);
        await Csrf(applicant);
        Assert.Equal("Yes", (await Read<MeetingRsvpDto>(await applicant.PutAsJsonAsync(path + "/rsvp", request))).Response);
        Assert.False((await applicant.GetAsync(path + "/rsvps")).IsSuccessStatusCode);
        Assert.Equal(member.PersonId, Assert.Single((await Read<Page<MeetingRsvpDto>>(await priest.GetAsync(path + "/rsvps"))).Items).PersonId);
        var schema = (await Read<JsonElement>(await priest.GetAsync("/openapi/v1.json"))).GetProperty("components").GetProperty("schemas");
        Assert.True(schema.TryGetProperty("MinistryMeetingDto", out _)); Assert.True(schema.TryGetProperty("MeetingRsvpDto", out _));
        Assert.False(schema.TryGetProperty("MinistryMeeting", out _)); Assert.False(schema.TryGetProperty("MeetingRsvp", out _));
    }

    [Fact]
    public async Task Suspended_selected_priest_cannot_read_edit_or_replay_existing_meeting_authority()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync();
        var service = Meetings(f); s.Use(); var request = Draft(f);
        var meeting = await service.SaveAsync(s.Parish, group.Id, null, request, default);
        var row = await service.GetAsync(s.Parish, group.Id, meeting.Id, default);
        f.As(f.Nominee);
        var appointment = await s.Staff.Service.GetAsync(s.Staff.Organization, s.Parish, s.Appointment, default);
        await s.Staff.ActAsync(appointment.Value, StaffAppointmentAction.Suspend);
        s.Use();
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Parish, group.Id, meeting.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Parish, group.Id, null, request, default));
        await Assert.ThrowsAsync<DomainException>(() => service.ActAsync(s.Parish, group.Id, meeting.Id,
            new MinistryMeetingActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "confirm" }, default));
        await Assert.ThrowsAsync<DomainException>(() => service.RsvpsAsync(s.Parish, group.Id, meeting.Id, 25, null, default));
        Assert.Equal("Draft", (await Event(f, s.Parish, meeting.EventId)).Value.Status);
        Assert.Single(await Records(f).CollectAsync<MinistryMeeting>(MinistryAccess.Scope(s.Parish), "ministryMeeting", default));
    }

    [Fact]
    public async Task Restricted_recovery_cookie_cannot_enter_meeting_RSVP_or_history_endpoints()
    {
        await using var f = new LocalBackendFixture(); f.Clock.Now = DateTimeOffset.UtcNow; await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); s.Use();
        var meeting = await Meetings(f).SaveAsync(s.Parish, group.Id, null, Draft(f), default);
        await Act(s, group.Id, meeting.Id, "confirm");
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await Login(client, "other@fixture.example", true);
        var codes = await Read<MfaRecoveryCodesDto>(await client.PostAsJsonAsync("/api/auth/mfa/recovery-codes", new RegenerateRecoveryCodesDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = "isolated-fixture-long-password",
            CurrentCode = TestAuthenticator.Code()
        }));
        await Csrf(client);
        var pending = await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login",
            new { username = "other@fixture.example", password = "isolated-fixture-long-password" }));
        var challenge = pending.GetProperty("challenge");
        await Read<RecoverySignInDto>(await client.PostAsJsonAsync("/api/auth/login/mfa/recovery", new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(f.Other),
            Challenge = challenge.GetProperty("challenge").GetString()!,
            RecoveryCode = codes.RecoveryCodes[0]
        }));
        await Csrf(client);
        client.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        var root = $"/api/parishes/{s.Parish}/ministries/{group.Id}/meetings";
        var path = root + "/" + meeting.Id;
        var window = "?start=" + Uri.EscapeDataString(f.Clock.Now.ToString("O")) + "&end=" + Uri.EscapeDataString(f.Clock.Now.AddDays(2).ToString("O"));
        foreach (var resource in new[] { root + window, path, path + "/rsvp", path + "/rsvps", path + "/history" })
        {
            var response = await client.GetAsync(resource);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("recovery_session_restricted", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString());
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync(root, Draft(f))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(path + "/rsvp",
            new RsvpDto { OperationId = Guid.NewGuid(), Response = "Yes" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync(path + "/actions",
            new MinistryMeetingActionDto { OperationId = Guid.NewGuid(), Version = "unavailable", Action = "cancel", Reason = "must not grant recovered authority" })).StatusCode);
        Assert.Empty(await Records(f).CollectAsync<MeetingRsvp>(MinistryAccess.Scope(s.Parish), "meetingRsvp", default));
        Assert.Equal("Confirmed", (await Event(f, s.Parish, meeting.EventId)).Value.Status);
    }

    private static MinistryMeetingService Meetings(LocalBackendFixture f) => f.Services.GetRequiredService<MinistryMeetingService>();
    private static IRecordTransactions Records(LocalBackendFixture f) => f.Services.GetRequiredService<IRecordTransactions>();
    private static async Task<Versioned<CalendarEvent>> Event(LocalBackendFixture f, string parish, string id)
        => (await Records(f).ReadAsync<CalendarEvent>(MinistryAccess.Scope(parish), "event:" + id, default))!;
    private static SaveMinistryMeetingDto Draft(LocalBackendFixture f) => new()
    {
        OperationId = Guid.NewGuid(), Title = "Isolated ministry meeting", StartsAt = f.Clock.Now.AddDays(1), EndsAt = f.Clock.Now.AddDays(1).AddHours(1),
        TimeZone = "UTC", Agenda = "Isolated group agenda", LocationDescription = "Actual supplied meeting location description"
    };
    private static async Task<MinistryMeetingDto> Act(MinistryScenario s, string ministry, string meeting, string action)
    {
        s.Use(); var service = Meetings(s.Fixture); var row = await service.GetAsync(s.Parish, ministry, meeting, default);
        return await service.ActAsync(s.Parish, ministry, meeting, new MinistryMeetingActionDto
        { OperationId = Guid.NewGuid(), Version = row.Version, Action = action, Reason = "Isolated meeting lifecycle decision" }, default);
    }
    private static async Task<(string AccountId, string PersonId, string Username)> Join(MinistryScenario s, string ministry)
    {
        var member = await s.LinkedApplicantAsync(); var application = await s.ApplyAsync(ministry, member.AccountId);
        await s.ApplicationActionAsync(ministry, application.Id, "approve"); return member;
    }
    private static async Task Login(HttpClient client, string username, bool mfa)
    {
        await Csrf(client);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username, password = "isolated-fixture-long-password" });
        if (mfa)
        {
            var challenge = (await Read<JsonElement>(response)).GetProperty("challenge");
            await Read<AccountDto>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
            {
                accountId = challenge.GetProperty("accountId").GetString(), challenge = challenge.GetProperty("challenge").GetString(),
                code = TestAuthenticator.Code()
            }));
        }
        else Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await Csrf(client);
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
