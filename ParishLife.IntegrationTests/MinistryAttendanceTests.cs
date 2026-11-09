// Purpose: verifies dated attendance snapshots, explicit observations, protected reporting corrections and private own-record HTTP access.
// Main tests: historical roster/rejoin, bounded resumability, conditional rollback, labeled unknown coverage, closure/review, legacy fail-closed and real cookie/MFA/CSRF flows.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryAttendanceTests
{
    [Fact]
    public async Task Actual_occurrence_periods_preserve_departed_rejoined_members_and_exclude_later_newcomers()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); var early = await s.LinkedApplicantAsync();
        await Join(s, group.Id, early.AccountId);
        var meeting = await Meeting(s, group.Id);
        s.Use();
        var futureVersion = (await MeetingService(f).GetAsync(s.Parish, group.Id, meeting.Id, default)).Version;
        Assert.Equal("invalid_attendance_state", (await Assert.ThrowsAsync<DomainException>(() => Service(f).OpenAsync(s.Parish, group.Id, meeting.Id,
            new AttendanceOpenDto { OperationId = Guid.NewGuid(), MeetingVersion = futureVersion }, default))).Code);
        f.Clock.Now = meeting.EndsAt.AddMinutes(1);
        var leave = await s.ApplyAsync(group.Id, early.AccountId, "Leave"); await s.ApplicationActionAsync(group.Id, leave.Id, "approve");
        f.Clock.Now = f.Clock.Now.AddMinutes(1); await Join(s, group.Id, early.AccountId);
        var late = await s.LinkedApplicantAsync(); await Join(s, group.Id, late.AccountId);
        await Ready(s, group.Id, meeting.Id); s.Use();
        var grid = await Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        Assert.Equal(1, grid.Sheet.Value.ExpectedCount);
        Assert.Equal(early.PersonId, Assert.Single(grid.Items).Value.PersonId);
        Assert.Equal("NotRecorded", grid.Items[0].Value.Status);
        Assert.Equal(1, grid.Sheet.Value.NotRecordedCount); Assert.Equal(0, grid.Sheet.Value.RecordedExpected);
        Assert.Equal(0m, grid.Sheet.Value.CoveragePercent); Assert.Equal(0, grid.Sheet.Value.AbsentCount);
        f.As(early.AccountId, false);
        Assert.Equal("NotRecorded", (await Service(f).OwnAsync(s.Parish, group.Id, meeting.Id, default)).Status);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default));
        f.As(late.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).OwnAsync(s.Parish, group.Id, meeting.Id, default));
    }

    [Fact]
    public async Task Snapshot_is_bounded_resumable_and_never_exposes_an_incomplete_grid_or_partial_failed_page()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync();
        await FixturePeriods(s, group.Id, 45);
        var meeting = await Meeting(s, group.Id); f.Clock.Now = meeting.EndsAt.AddMinutes(1); s.Use();
        var opened = await Open(s, group.Id, meeting.Id); s.Use();
        Assert.Equal("Building", opened.Value.Status); Assert.False(opened.Value.SnapshotComplete);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default));
        var current = opened;
        while (current.Value.SnapshotPhase == "MembershipValidation")
            current = await Service(f).AdvanceSnapshotAsync(s.Parish, group.Id, meeting.Id,
                new AttendanceSnapshotDto { OperationId = Guid.NewGuid(), Version = current.Version }, default);
        Assert.Equal(0, current.Value.ExpectedCount); Assert.Equal("Building", current.Value.Status);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => Service(f).AdvanceSnapshotAsync(s.Parish, group.Id, meeting.Id,
            new AttendanceSnapshotDto { OperationId = Guid.NewGuid(), Version = "stale" }, default))).Code);
        Assert.Empty((await Records(f).PageAsync<AttendanceRow>(MinistryAccess.Scope(s.Parish), "attendanceRow", 100, null, default)).Items);
        var first = new AttendanceSnapshotDto { OperationId = Guid.NewGuid(), Version = current.Version };
        current = await Service(f).AdvanceSnapshotAsync(s.Parish, group.Id, meeting.Id, first, default);
        Assert.Equal(40, current.Value.ExpectedCount); Assert.Equal("Building", current.Value.Status); Assert.Equal(0, current.Value.Denominator);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default));
        current = await Service(f).AdvanceSnapshotAsync(s.Parish, group.Id, meeting.Id,
            new AttendanceSnapshotDto { OperationId = Guid.NewGuid(), Version = current.Version }, default);
        Assert.Equal("Ready", current.Value.Status); Assert.Equal(45, current.Value.ExpectedCount); Assert.Equal(45, current.Value.NotRecordedCount);
        Assert.Equal(45, (await Service(f).AdvanceSnapshotAsync(s.Parish, group.Id, meeting.Id, first, default)).Value.ExpectedCount);
        var firstPage = await Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        var secondPage = await Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, firstPage.ContinuationToken, default);
        Assert.Equal(45, firstPage.Items.Concat(secondPage.Items).Select(x => x.Value.PersonId).Distinct().Count());
        Assert.All(firstPage.Items.Concat(secondPage.Items), x => Assert.Equal("NotRecorded", x.Value.Status));
    }

    [Fact]
    public async Task Explicit_states_keep_unknown_and_not_expected_distinct_and_closed_corrections_preserve_private_history()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); await FixturePeriods(s, group.Id, 6);
        var meeting = await Meeting(s, group.Id); f.Clock.Now = meeting.EndsAt.AddMinutes(1);
        await Ready(s, group.Id, meeting.Id); s.Use();
        var service = Service(f); var grid = await service.GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        var statuses = new[] { "Present", "Late", "Absent", "Excused", "NotExpected" };
        var write = new AttendanceWriteDto
        {
            OperationId = Guid.NewGuid(), Version = grid.Sheet.Version,
            Entries = statuses.Select((value, index) => new AttendanceWriteEntryDto
            { PersonId = Guid.Parse(grid.Items[index].Value.PersonId), Version = grid.Items[index].Version, Status = value }).ToArray()
        };
        var recorded = await service.RecordAsync(s.Parish, group.Id, meeting.Id, write, default);
        Assert.Equal(6, recorded.Value.ExpectedCount); Assert.Equal(5, recorded.Value.Denominator);
        Assert.Equal(4, recorded.Value.RecordedExpected); Assert.Equal(1, recorded.Value.NotRecordedCount); Assert.Equal(1, recorded.Value.NotExpectedCount);
        Assert.Equal(1, recorded.Value.ExcusedCount); Assert.Equal(2, recorded.Value.PresentOrLate);
        Assert.Equal(80m, recorded.Value.CoveragePercent); Assert.Equal(40m, recorded.Value.PresentOrLatePercent);
        var close = new AttendanceCloseDto
        { OperationId = Guid.NewGuid(), Version = recorded.Version, Reason = "Private isolated review of an unknown row", ReportingReference = "Actual isolated reporting review" };
        var closed = await service.CloseAsync(s.Parish, group.Id, meeting.Id, close, default);
        Assert.Equal("Closed", closed.Value.Status); Assert.Equal(1, closed.Value.NotRecordedCount);
        grid = await service.GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        var unknown = Assert.Single(grid.Items, x => x.Value.Status == "NotRecorded");
        await Assert.ThrowsAsync<DomainException>(() => service.RecordAsync(s.Parish, group.Id, meeting.Id,
            new AttendanceWriteDto { OperationId = Guid.NewGuid(), Version = closed.Version, Entries = [new AttendanceWriteEntryDto
            { PersonId = Guid.Parse(unknown.Value.PersonId), Version = unknown.Version, Status = "Absent" }] }, default));
        var correction = new AttendanceCorrectDto
        {
            OperationId = Guid.NewGuid(), Version = closed.Version, PersonId = Guid.Parse(unknown.Value.PersonId), RowVersion = unknown.Version,
            Status = "Present", Reason = "Private isolated late evidence", ReviewReference = "Actual isolated eligible reviewer evidence"
        };
        var corrected = await service.CorrectAsync(s.Parish, group.Id, meeting.Id, correction, default);
        Assert.Equal("Closed", corrected.Value.Status); Assert.Equal(closed.Value.ClosedAt, corrected.Value.ClosedAt);
        Assert.Equal(0, corrected.Value.NotRecordedCount); Assert.Equal(3, corrected.Value.PresentOrLate);
        Assert.Equal(100m, corrected.Value.CoveragePercent); Assert.Equal(60m, corrected.Value.PresentOrLatePercent);
        Assert.Equal(3, (await service.RecordAsync(s.Parish, group.Id, meeting.Id, write, default)).Value.PresentOrLate);
        var history = await service.HistoryAsync(s.Parish, group.Id, meeting.Id, 100, null, default);
        Assert.Contains(history.Items, x => x.Action == "close" && x.NotRecordedCount == 1 && x.ReviewReference == close.ReportingReference);
        Assert.Contains(history.Items, x => x.Action == "correct-closed" && x.PreviousStatus == "NotRecorded" && x.NewStatus == "Present"
            && x.ActorId == f.Other && x.Reason == correction.Reason && x.ReviewReference == correction.ReviewReference);
        var allJson = string.Join("\n", Directory.EnumerateFiles(f.DirectoryPath, "*.json", SearchOption.AllDirectories).Select(File.ReadAllText));
        Assert.DoesNotContain(close.Reason, allJson); Assert.DoesNotContain(close.ReportingReference, allJson);
        Assert.DoesNotContain(correction.Reason, allJson); Assert.DoesNotContain(correction.ReviewReference, allJson);
        var projection = JsonSerializer.Serialize(corrected.Value);
        Assert.DoesNotContain("Private isolated", projection); Assert.DoesNotContain("ReportingReference", projection);
    }

    [Fact]
    public async Task Stale_row_in_a_multi_person_batch_rolls_back_all_statuses_counters_and_history()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); await FixturePeriods(s, group.Id, 2);
        var meeting = await Meeting(s, group.Id); f.Clock.Now = meeting.EndsAt.AddMinutes(1);
        await Ready(s, group.Id, meeting.Id); s.Use();
        var service = Service(f); var grid = await service.GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        var before = (await service.HistoryAsync(s.Parish, group.Id, meeting.Id, 100, null, default)).Items.Count;
        var request = new AttendanceWriteDto
        {
            OperationId = Guid.NewGuid(), Version = grid.Sheet.Version,
            Entries = grid.Items.Select((x, index) => new AttendanceWriteEntryDto
            { PersonId = Guid.Parse(x.Value.PersonId), Version = index == 0 ? x.Version : "stale", Status = "Present" }).ToArray()
        };
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.RecordAsync(s.Parish, group.Id, meeting.Id, request, default))).Code);
        var after = await service.GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        Assert.Equal(grid.Sheet.Version, after.Sheet.Version); Assert.Equal(0, after.Sheet.Value.PresentCount);
        Assert.All(after.Items, x => Assert.Equal("NotRecorded", x.Value.Status));
        Assert.Equal(before, (await service.HistoryAsync(s.Parish, group.Id, meeting.Id, 100, null, default)).Items.Count);
    }

    [Fact]
    public async Task Attendance_duties_are_explicit_and_revoked_leaders_cannot_replay_previously_authorized_writes()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); await FixturePeriods(s, group.Id, 1);
        var meeting = await Meeting(s, group.Id); f.Clock.Now = meeting.EndsAt.AddMinutes(1);
        await Ready(s, group.Id, meeting.Id); var leader = await f.CreateVerifiedStaffAsync(); s.Use();
        var leadership = f.Services.GetRequiredService<MinistryLeadershipService>();
        await leadership.AppointAsync(s.Parish, group.Id, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, group.Id, default)).Version,
            AccountId = Guid.Parse(leader), Role = "Leader", StartsAt = f.Clock.Now, EvidenceReference = "Isolated actual group appointment"
        }, default);
        f.As(leader);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default));
        s.Use();
        await leadership.ChangeDutiesAsync(s.Parish, group.Id, leader, new ChangeMinistryLeaderDutiesDto
        {
            OperationId = Guid.NewGuid(), Version = (await leadership.GetAsync(s.Parish, group.Id, leader, default)).Version,
            Duties = ["attendance.record"], Reason = "Isolated explicit recording delegation", EvidenceReference = "Isolated actual delegation reference"
        }, default);
        f.As(leader);
        var grid = await Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        var cell = Assert.Single(grid.Items);
        var write = new AttendanceWriteDto
        {
            OperationId = Guid.NewGuid(), Version = grid.Sheet.Version,
            Entries = [new AttendanceWriteEntryDto { PersonId = Guid.Parse(cell.Value.PersonId), Version = cell.Version, Status = "Present" }]
        };
        var recorded = await Service(f).RecordAsync(s.Parish, group.Id, meeting.Id, write, default);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).CloseAsync(s.Parish, group.Id, meeting.Id,
            new AttendanceCloseDto { OperationId = Guid.NewGuid(), Version = recorded.Version, Reason = "Insufficient duty", ReportingReference = "Must not grant review" }, default));
        f.AsAppointment(leader, s.Appointment);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default));
        s.Use();
        await leadership.ChangeDutiesAsync(s.Parish, group.Id, leader, new ChangeMinistryLeaderDutiesDto
        {
            OperationId = Guid.NewGuid(), Version = (await leadership.GetAsync(s.Parish, group.Id, leader, default)).Version,
            Duties = [], Reason = "Isolated duty revocation", EvidenceReference = "Isolated revocation evidence"
        }, default);
        f.As(leader);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).RecordAsync(s.Parish, group.Id, meeting.Id, write, default));
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default));
    }

    [Fact]
    public async Task Review_only_duty_can_read_and_close_without_receiving_recording_authority()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); await FixturePeriods(s, group.Id, 1);
        var meeting = await Meeting(s, group.Id); f.Clock.Now = meeting.EndsAt.AddMinutes(1);
        await Ready(s, group.Id, meeting.Id); var reviewer = await f.CreateVerifiedStaffAsync(); s.Use();
        await f.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, group.Id, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, group.Id, default)).Version,
            AccountId = Guid.Parse(reviewer), Role = "Assistant", StartsAt = f.Clock.Now, Duties = ["attendance.review"],
            EvidenceReference = "Isolated explicitly qualified reporting reviewer"
        }, default);
        f.As(reviewer);
        var grid = await Service(f).GridAsync(s.Parish, group.Id, meeting.Id, 25, null, default);
        var cell = Assert.Single(grid.Items);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).RecordAsync(s.Parish, group.Id, meeting.Id,
            new AttendanceWriteDto { OperationId = Guid.NewGuid(), Version = grid.Sheet.Version,
                Entries = [new AttendanceWriteEntryDto { PersonId = Guid.Parse(cell.Value.PersonId), Version = cell.Version, Status = "Present" }] }, default));
        var request = new AttendanceCloseDto { OperationId = Guid.NewGuid(), Version = grid.Sheet.Version, Reason = "Unknown retained at actual review", ReportingReference = "Isolated actual reporting review" };
        var closed = await Service(f).CloseAsync(s.Parish, group.Id, meeting.Id, request, default);
        Assert.Equal("Closed", closed.Value.Status); Assert.Equal(1, closed.Value.NotRecordedCount);
        Assert.Equal("Closed", (await Service(f).CloseAsync(s.Parish, group.Id, meeting.Id, request, default)).Value.Status);
        Assert.Contains((await Service(f).HistoryAsync(s.Parish, group.Id, meeting.Id, 25, null, default)).Items, x => x.Action == "close");
    }

    [Fact]
    public async Task Missing_legacy_period_fails_closed_and_does_not_publish_an_empty_ready_roster()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); await FixturePeriods(s, group.Id, 1);
        var meeting = await Meeting(s, group.Id); f.Clock.Now = meeting.EndsAt.AddMinutes(1); s.Use();
        var scope = MinistryAccess.Scope(s.Parish);
        var member = Assert.Single((await Records(f).PageAsync<MinistryMembership>(scope, "ministryMembership", 25, null, default)).Items);
        member.Value.PeriodId = string.Empty;
        await Records(f).CommitAsync(scope, Operation.Create(Guid.NewGuid(), f.Other, new { corrupt = member.Value.PersonId }, f.Clock), "fixture.legacy_membership", member.Value.PersonId,
            [RecordChange.Replace(MinistryAccess.MemberKey(group.Id, member.Value.PersonId), "ministryMembership", member.Value, member.Version)], new CommandResult { Id = member.Value.PersonId }, default);
        var opened = await Open(s, group.Id, meeting.Id); s.Use();
        Assert.Equal("attendance_roster_review_required", (await Assert.ThrowsAsync<DomainException>(() => Service(f).AdvanceSnapshotAsync(s.Parish, group.Id, meeting.Id,
            new AttendanceSnapshotDto { OperationId = Guid.NewGuid(), Version = opened.Version }, default))).Code);
        var current = await Service(f).GetAsync(s.Parish, group.Id, meeting.Id, default);
        Assert.Equal(opened.Version, current.Version); Assert.Equal("Building", current.Value.Status); Assert.False(current.Value.SnapshotComplete);
        Assert.Empty((await Records(f).PageAsync<AttendanceRow>(scope, "attendanceRow", 25, null, default)).Items);
    }

    [Fact]
    public async Task Actual_HTTP_attendance_uses_current_duties_CSRF_and_safe_own_projections()
    {
        await using var f = new LocalBackendFixture(); f.Clock.Now = DateTimeOffset.UtcNow.AddHours(-3); await f.InitializeAsync();
        var s = await Scenario(f); var group = await s.MinistryAsync(); var person = await s.LinkedApplicantAsync(); await Join(s, group.Id, person.AccountId);
        var meeting = await Meeting(s, group.Id, f.Clock.Now.AddHours(1)); f.Clock.Now = DateTimeOffset.UtcNow;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var priest = factory.Client(); using var applicant = factory.Client(); using var visitor = factory.Client();
        var path = $"/api/parishes/{s.Parish}/ministries/{group.Id}/meetings/{meeting.Id}/attendance";
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(path)).StatusCode);
        await Login(priest, "other@fixture.example", true); priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        var meetingRow = await Read<Versioned<MinistryMeetingDto>>(await priest.GetAsync($"/api/parishes/{s.Parish}/ministries/{group.Id}/meetings/{meeting.Id}"));
        var request = new AttendanceOpenDto { OperationId = Guid.NewGuid(), MeetingVersion = meetingRow.Version };
        priest.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.PostAsJsonAsync(path, request)).StatusCode);
        await Csrf(priest);
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.PostAsJsonAsync(path, new AttendanceOpenDto { OperationId = Guid.Empty, MeetingVersion = meetingRow.Version })).StatusCode);
        var response = await priest.PostAsJsonAsync(path, request); Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var sheet = await Read<Versioned<AttendanceSheetDto>>(response);
        while (!sheet.Value.SnapshotComplete)
            sheet = await Read<Versioned<AttendanceSheetDto>>(await priest.PostAsJsonAsync(path + "/snapshot", new AttendanceSnapshotDto { OperationId = Guid.NewGuid(), Version = sheet.Version }));
        var grid = await Read<AttendanceRowsDto>(await priest.GetAsync(path + "/rows")); var row = Assert.Single(grid.Items);
        await Login(applicant, person.Username, false);
        Assert.Equal("NotRecorded", (await Read<AttendanceValueDto>(await applicant.GetAsync(path + "/mine"))).Status);
        Assert.False((await applicant.GetAsync(path + "/rows")).IsSuccessStatusCode);
        Assert.False((await applicant.GetAsync(path + "/history")).IsSuccessStatusCode);
        var write = new AttendanceWriteDto { OperationId = Guid.NewGuid(), Version = grid.Sheet.Version,
            Entries = [new AttendanceWriteEntryDto { PersonId = Guid.Parse(row.Value.PersonId), Version = row.Version, Status = "Present" }] };
        Assert.False((await applicant.PostAsJsonAsync(path + "/records", write)).IsSuccessStatusCode);
        Assert.Equal(1, (await Read<Versioned<AttendanceSheetDto>>(await priest.PostAsJsonAsync(path + "/records", write))).Value.PresentCount);
        Assert.Equal("Present", (await Read<AttendanceValueDto>(await applicant.GetAsync(path + "/mine"))).Status);
        var api = await Read<JsonElement>(await priest.GetAsync("/openapi/v1.json")); var schemas = api.GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.TryGetProperty("AttendanceSheetDto", out _)); Assert.True(schemas.TryGetProperty("AttendanceValueDto", out _));
        Assert.False(schemas.TryGetProperty("AttendanceSheet", out _)); Assert.False(schemas.TryGetProperty("AttendanceRow", out _)); Assert.False(schemas.TryGetProperty("AttendanceChange", out _));
    }

    private static MinistryAttendanceService Service(LocalBackendFixture f) => f.Services.GetRequiredService<MinistryAttendanceService>();
    private static MinistryMeetingService MeetingService(LocalBackendFixture f) => f.Services.GetRequiredService<MinistryMeetingService>();
    private static IRecordTransactions Records(LocalBackendFixture f) => f.Services.GetRequiredService<IRecordTransactions>();
    private static Task<MinistryScenario> Scenario(LocalBackendFixture f) => MinistryScenario.CreateAsync(f,
        [Permissions.MinistriesAttendanceRecord, Permissions.MinistriesAttendanceReview]);
    private static async Task Join(MinistryScenario s, string ministry, string account)
    {
        var application = await s.ApplyAsync(ministry, account); await s.ApplicationActionAsync(ministry, application.Id, "approve");
    }
    private static async Task<MinistryMeetingDto> Meeting(MinistryScenario s, string ministry, DateTimeOffset? startsAt = null)
    {
        s.Use(); var at = startsAt ?? s.Fixture.Clock.Now.AddDays(1);
        var value = await MeetingService(s.Fixture).SaveAsync(s.Parish, ministry, null, new SaveMinistryMeetingDto
        { OperationId = Guid.NewGuid(), Title = "Isolated actual group meeting", StartsAt = at, EndsAt = at.AddHours(1), TimeZone = "UTC" }, default);
        var row = await MeetingService(s.Fixture).GetAsync(s.Parish, ministry, value.Id, default);
        return await MeetingService(s.Fixture).ActAsync(s.Parish, ministry, value.Id,
            new MinistryMeetingActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "confirm" }, default);
    }
    private static async Task<Versioned<AttendanceSheetDto>> Open(MinistryScenario s, string ministry, string meeting)
    {
        s.Use(); var row = await MeetingService(s.Fixture).GetAsync(s.Parish, ministry, meeting, default);
        return await Service(s.Fixture).OpenAsync(s.Parish, ministry, meeting,
            new AttendanceOpenDto { OperationId = Guid.NewGuid(), MeetingVersion = row.Version }, default);
    }
    private static async Task<Versioned<AttendanceSheetDto>> Ready(MinistryScenario s, string ministry, string meeting)
    {
        var row = await Open(s, ministry, meeting); s.Use();
        while (!row.Value.SnapshotComplete)
            row = await Service(s.Fixture).AdvanceSnapshotAsync(s.Parish, ministry, meeting,
                new AttendanceSnapshotDto { OperationId = Guid.NewGuid(), Version = row.Version }, default);
        return row;
    }
    private static async Task FixturePeriods(MinistryScenario s, string ministry, int count)
    {
        s.Use(); var scope = MinistryAccess.Scope(s.Parish); var changes = new List<RecordChange>();
        // Deliberate isolated source fixtures exercise multi-page storage behavior without creating 45 login credentials.
        // Actual join/departure/rejoin behavior is exercised separately through application services above.
        for (var index = 0; index < count; index++)
        {
            var person = Guid.NewGuid().ToString("N"); var period = Guid.NewGuid().ToString("N");
            changes.Add(RecordChange.Create("ministryMembershipPeriod:" + period, "ministryMembershipPeriod", new MinistryMembershipPeriod
            { Id = period, MinistryId = ministry, PersonId = person, JoinedAt = s.Fixture.Clock.Now, JoinApplicationId = period, ApprovedBy = s.Fixture.Other }));
            changes.Add(RecordChange.Create(MinistryAccess.MemberKey(ministry, person), "ministryMembership", new MinistryMembership
            { Id = person, MinistryId = ministry, PersonId = person, JoinedAt = s.Fixture.Clock.Now, PeriodId = period, ApplicationId = period, ApprovedBy = s.Fixture.Other }));
        }
        await Records(s.Fixture).CommitAsync(scope, Operation.Create(Guid.NewGuid(), s.Fixture.Other, new { ministry, count }, s.Fixture.Clock),
            "fixture.dated_roster", ministry, changes, new CommandResult { Id = ministry }, default);
    }
    private static async Task Login(HttpClient client, string username, bool mfa)
    {
        await Csrf(client);
        var result = await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username, password = "isolated-fixture-long-password" }));
        if (mfa)
        {
            var challenge = result.GetProperty("challenge");
            await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
            { accountId = challenge.GetProperty("accountId").GetString(), challenge = challenge.GetProperty("challenge").GetString(), code = TestAuthenticator.Code() }));
        }
        await Csrf(client);
    }
    private static async Task Csrf(HttpClient client)
    {
        var result = await Read<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN"); client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", result.GetProperty("token").GetString());
    }
    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
