// Purpose: verifies reviewed additional-person attendance without inventing membership, expected absences or private access.
// Main tests: separate guest counters/history, conditional batch rollback, review-only admission, legacy reconciliation,
// closed correction and actual HTTP/MFA/CSRF/own-row contracts against isolated local records.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryAttendanceGuestTests
{
    [Fact]
    public async Task Reviewed_guests_keep_separate_counts_and_never_create_membership_or_expected_absences()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var guest = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        var service = Service(f);
        var request = await Request(s, guest.PersonId);
        var added = await service.AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default);
        Assert.Equal(1, added.Value.GuestCount);
        Assert.Equal(1, added.Value.GuestCounts!.NotRecorded);
        Assert.Equal(1, added.Value.ExpectedCount);
        Assert.Equal(1, added.Value.NotRecordedCount);
        Assert.Equal(1, added.Value.Denominator);
        Assert.Equal(0m, added.Value.CoveragePercent);
        Assert.Null(await Records(f).ReadAsync<MinistryMembership>(Area(s), MinistryAccess.MemberKey(s.Group, guest.PersonId), default));
        var grid = await service.GridAsync(s.Scope.Parish, s.Group, s.Meeting, 25, null, default);
        Assert.Equal(2, grid.Items.Count);
        var recorded = await service.RecordAsync(s.Scope.Parish, s.Group, s.Meeting, new AttendanceWriteDto
        {
            OperationId = Guid.NewGuid(),
            Version = grid.Sheet.Version,
            Entries = grid.Items.Select(row => new AttendanceWriteEntryDto
            { PersonId = Guid.Parse(row.Value.PersonId), Version = row.Version, Status = row.Value.ParticipantKind == "Guest" ? "Present" : "Absent" }).ToArray()
        }, default);
        Assert.Equal(1, recorded.Value.AbsentCount);
        Assert.Equal(0, recorded.Value.PresentCount);
        Assert.Equal(100m, recorded.Value.CoveragePercent);
        Assert.Equal(0m, recorded.Value.PresentOrLatePercent);
        Assert.Equal(1, recorded.Value.GuestCounts!.Present);
        Assert.Equal(0, recorded.Value.GuestCounts.NotRecorded);
        var replay = await service.AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default);
        Assert.Equal(1, replay.Value.GuestCount);
        Assert.Equal(1, replay.Value.GuestCounts!.Present);
        var history = await service.HistoryAsync(s.Scope.Parish, s.Group, s.Meeting, 100, null, default);
        var admission = Assert.Single(history.Items, x => x.Action == "guest-add");
        Assert.Equal("Guest", admission.ParticipantKind);
        Assert.Equal(request.IdentityReviewReference, admission.ReviewReference);
        Assert.Equal(request.Reason, admission.Reason);
        Assert.Equal(1, admission.GuestCounts!.NotRecorded);
        Assert.Equal(0, admission.GuestCounts.Present);
        var metadata = JsonSerializer.Serialize(new
        {
            Audit = await Records(f).PageAsync<JsonElement>(Area(s), "audit", 100, null, default),
            Receipts = await Records(f).PageAsync<JsonElement>(Area(s), "operation", 100, null, default),
            Grid = await service.GridAsync(s.Scope.Parish, s.Group, s.Meeting, 25, null, default),
            ProtectedHistory = await Records(f).PageAsync<AttendanceChange>(Area(s), "attendanceChange", 100, null, default)
        });
        Assert.DoesNotContain(request.Reason, metadata, StringComparison.Ordinal);
        Assert.DoesNotContain(request.IdentityReviewReference, metadata, StringComparison.Ordinal);
        f.As(guest.AccountId, false);
        Assert.Equal("Guest", (await service.OwnAsync(s.Scope.Parish, s.Group, s.Meeting, default)).ParticipantKind);
        await Assert.ThrowsAsync<DomainException>(() => s.Scope.Ministries.MemberInfoAsync(s.Scope.Parish, s.Group, default));
        await Assert.ThrowsAsync<DomainException>(() => service.GridAsync(s.Scope.Parish, s.Group, s.Meeting, 25, null, default));
    }

    [Fact]
    public async Task Existing_members_and_duplicate_guests_cannot_be_reclassified_and_admission_needs_review_authority()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var guest = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        var existingMember = await Request(s, s.Member);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, existingMember, default));
        var request = await Request(s, guest.PersonId);
        s.Scope.Use();
        await Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default);
        var duplicate = await Request(s, guest.PersonId);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, duplicate, default));
        var leader = await f.CreateVerifiedStaffAsync();
        s.Scope.Use();
        await f.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Scope.Parish, s.Group, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(),
            MinistryVersion = (await s.Scope.Ministries.GetAsync(s.Scope.Parish, s.Group, default)).Version,
            AccountId = Guid.Parse(leader),
            Role = "Leader",
            Duties = ["attendance.record"],
            StartsAt = f.Clock.Now,
            EndsAt = f.Clock.Now.AddDays(5),
            EvidenceReference = "Actual isolated recorder appointment"
        }, default);
        f.As(leader);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default));
        f.AsRecovery(f.Other);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default));
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default));
        s.Scope.Use();
        Assert.Equal(1, (await Service(f).GetAsync(s.Scope.Parish, s.Group, s.Meeting, default)).Value.GuestCount);
    }

    [Fact]
    public async Task Stale_sheet_and_concurrent_person_archive_roll_back_guest_counters_history_and_receipt()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var guest = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        var stale = await Request(s, guest.PersonId);
        stale.Version = "stale";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, stale, default))).Code);
        var request = await Request(s, guest.PersonId);
        var intercept = new CommitInterceptionRecords(Records(f), async () =>
        {
            s.Scope.Use();
            var people = f.Services.GetRequiredService<PeopleService>();
            var person = await people.GetAsync(s.Scope.Parish, guest.PersonId, default);
            await people.SetArchiveAsync(s.Scope.Parish, guest.PersonId, new ArchivePersonDto
            { OperationId = Guid.NewGuid(), Version = person.Version, Archived = true }, default);
        });
        var service = ActivatorUtilities.CreateInstance<MinistryAttendanceService>(f.Services, intercept);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default))).Code);
        Assert.Null(await Records(f).ReadAsync<AttendanceRow>(Area(s), "attendanceRow:" + s.Meeting + ":" + guest.PersonId, default));
        Assert.Null(await Records(f).ReadAsync<JsonElement>(Area(s), "operation:" + request.OperationId.ToString("N"), default));
        Assert.DoesNotContain((await Records(f).PageAsync<AttendanceChange>(Area(s), "attendanceChange", 100, null, default)).Items,
            row => row.Value.Action == "guest-add");
        s.Scope.Use();
        Assert.Equal(0, (await Service(f).GetAsync(s.Scope.Parish, s.Group, s.Meeting, default)).Value.GuestCount);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default));
    }

    [Fact]
    public async Task Legacy_unknown_guest_totals_are_verified_before_initialization_and_unreconciled_rows_fail_closed()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var guest = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        await ChangeSheet(s, sheet => sheet.GuestCounts = null);
        Assert.Null((await Service(f).GetAsync(s.Scope.Parish, s.Group, s.Meeting, default)).Value.GuestCount);
        await Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, await Request(s, guest.PersonId), default);
        Assert.Equal(1, (await Service(f).GetAsync(s.Scope.Parish, s.Group, s.Meeting, default)).Value.GuestCount);
        await ChangeSheet(s, sheet => sheet.GuestCounts = null);
        var other = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        var request = await Request(s, other.PersonId);
        Assert.Equal("attendance_roster_review_required", (await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(
            s.Scope.Parish, s.Group, s.Meeting, request, default))).Code);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).GridAsync(s.Scope.Parish, s.Group, s.Meeting, 25, null, default));
        Assert.Null(await Records(f).ReadAsync<AttendanceRow>(Area(s), "attendanceRow:" + s.Meeting + ":" + other.PersonId, default));
    }

    [Fact]
    public async Task Closed_guest_correction_updates_only_guest_totals_and_does_not_allow_new_admission()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var guest = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        var request = await Request(s, guest.PersonId);
        request.Status = "Present";
        var added = await Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default);
        var closed = await Service(f).CloseAsync(s.Scope.Parish, s.Group, s.Meeting, new AttendanceCloseDto
        { OperationId = Guid.NewGuid(), Version = added.Version, Reason = "Actual isolated report review", ReportingReference = "Actual isolated reporting evidence" }, default);
        var row = Assert.Single((await Service(f).GridAsync(s.Scope.Parish, s.Group, s.Meeting, 25, null, default)).Items, x => x.Value.ParticipantKind == "Guest");
        var corrected = await Service(f).CorrectAsync(s.Scope.Parish, s.Group, s.Meeting, new AttendanceCorrectDto
        {
            OperationId = Guid.NewGuid(),
            Version = closed.Version,
            PersonId = Guid.Parse(guest.PersonId),
            RowVersion = row.Version,
            Status = "NotExpected",
            Reason = "Actual isolated correction",
            ReviewReference = "Actual isolated correction evidence"
        }, default);
        Assert.Equal("Closed", corrected.Value.Status);
        Assert.Equal(1, corrected.Value.GuestCounts!.NotExpected);
        Assert.Equal(0, corrected.Value.GuestCounts.Present);
        Assert.Equal(1, corrected.Value.Denominator);
        Assert.Equal(1, corrected.Value.NotRecordedCount);
        Assert.Equal(0m, corrected.Value.CoveragePercent);
        var other = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        var closedAdmission = await Request(s, other.PersonId);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, closedAdmission, default));
    }

    [Fact]
    public async Task Empty_nonterminal_legacy_query_does_not_establish_zero_guests_or_commit_admission()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var guest = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        await ChangeSheet(s, sheet => sheet.GuestCounts = null);
        var request = await Request(s, guest.PersonId);
        var service = ActivatorUtilities.CreateInstance<MinistryAttendanceService>(f.Services, new EmptyGuestPageRecords(Records(f)));
        Assert.Equal("attendance_roster_review_required", (await Assert.ThrowsAsync<DomainException>(() =>
            service.AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default))).Code);
        Assert.Null((await Service(f).GetAsync(s.Scope.Parish, s.Group, s.Meeting, default)).Value.GuestCount);
        Assert.Null(await Records(f).ReadAsync<AttendanceRow>(Area(s), "attendanceRow:" + s.Meeting + ":" + guest.PersonId, default));
        Assert.Null(await Records(f).ReadAsync<JsonElement>(Area(s), "operation:" + request.OperationId.ToString("N"), default));
    }

    [Fact]
    public async Task Review_only_admission_preserves_unknown_attendance_and_never_gains_recording_authority()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var guest = await s.Scope.LinkedApplicantAsync();
        var reviewer = await f.CreateVerifiedStaffAsync();
        s.Scope.Use();
        await f.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Scope.Parish, s.Group, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(),
            MinistryVersion = (await s.Scope.Ministries.GetAsync(s.Scope.Parish, s.Group, default)).Version,
            AccountId = Guid.Parse(reviewer),
            Role = "Assistant",
            Duties = ["attendance.review"],
            StartsAt = f.Clock.Now,
            EndsAt = f.Clock.Now.AddDays(5),
            EvidenceReference = "Actual isolated identity reviewer appointment"
        }, default);
        var request = await Request(s, guest.PersonId);
        request.Status = "Present";
        f.As(reviewer);
        await Assert.ThrowsAsync<DomainException>(() => Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default));
        request.OperationId = Guid.NewGuid();
        request.Status = "NotRecorded";
        var admitted = await Service(f).AddGuestAsync(s.Scope.Parish, s.Group, s.Meeting, request, default);
        Assert.Equal(1, admitted.Value.GuestCounts!.NotRecorded);
        Assert.Equal(0, admitted.Value.GuestCounts.Present);
        var row = Assert.Single((await Service(f).GridAsync(s.Scope.Parish, s.Group, s.Meeting, 25, null, default)).Items, x => x.Value.ParticipantKind == "Guest");
        await Assert.ThrowsAsync<DomainException>(() => Service(f).RecordAsync(s.Scope.Parish, s.Group, s.Meeting, new AttendanceWriteDto
        { OperationId = Guid.NewGuid(), Version = admitted.Version, Entries = [new AttendanceWriteEntryDto { PersonId = Guid.Parse(guest.PersonId), Version = row.Version, Status = "Present" }] }, default));
    }

    [Fact]
    public async Task Http_admission_requires_reviewed_identity_MFA_and_CSRF_and_exposes_only_typed_guest_contracts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.Clock.Now = DateTimeOffset.UtcNow.AddDays(-2);
        var s = await Setup(f);
        var guest = await s.Scope.LinkedApplicantAsync();
        s.Scope.Use();
        var request = await Request(s, guest.PersonId);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        var path = $"/api/parishes/{s.Scope.Parish}/ministries/{s.Group}/meetings/{s.Meeting}/attendance";
        await Csrf(client);
        var login = (await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login",
            new { username = "other@fixture.example", password = "isolated-fixture-long-password" }))).GetProperty("challenge");
        await Read<AccountDto>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
        { accountId = login.GetProperty("accountId").GetString(), challenge = login.GetProperty("challenge").GetString(), code = TestAuthenticator.Code() }));
        await Csrf(client);
        client.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Scope.Appointment);
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(path + "/guests", request)).StatusCode);
        await Csrf(client);
        var originalReference = request.IdentityReviewReference;
        request.IdentityReviewReference = "";
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(path + "/guests", request)).StatusCode);
        request.IdentityReviewReference = originalReference;
        Assert.Equal(1, (await Read<Versioned<AttendanceSheetDto>>(await client.PostAsJsonAsync(path + "/guests", request))).Value.GuestCount);
        var schemas = (await Read<JsonElement>(await client.GetAsync("/openapi/v1.json"))).GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.TryGetProperty("AttendanceGuestDto", out _));
        Assert.True(schemas.TryGetProperty("AttendanceGuestCountsDto", out _));
        Assert.False(schemas.TryGetProperty("AttendanceGuestCounts", out _));
        Assert.False(schemas.TryGetProperty("AttendanceRow", out _));
    }

    private static async Task<GuestScenario> Setup(LocalBackendFixture f)
    {
        var s = await MinistryScenario.CreateAsync(f, [Permissions.MinistriesAttendanceRecord, Permissions.MinistriesAttendanceReview]);
        var group = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync();
        var application = await s.ApplyAsync(group.Id, member.AccountId);
        await s.ApplicationActionAsync(group.Id, application.Id, "approve");
        s.Use();
        var meetings = f.Services.GetRequiredService<MinistryMeetingService>();
        var meeting = await meetings.SaveAsync(s.Parish, group.Id, null, new SaveMinistryMeetingDto
        { OperationId = Guid.NewGuid(), Title = "Isolated guest attendance meeting", StartsAt = f.Clock.Now.AddDays(1), EndsAt = f.Clock.Now.AddDays(1).AddHours(1), TimeZone = "UTC" }, default);
        var version = (await meetings.GetAsync(s.Parish, group.Id, meeting.Id, default)).Version;
        await meetings.ActAsync(s.Parish, group.Id, meeting.Id, new MinistryMeetingActionDto { OperationId = Guid.NewGuid(), Version = version, Action = "confirm" }, default);
        f.Clock.Now = meeting.EndsAt.AddMinutes(1);
        s.Use();
        var sheet = await Service(f).OpenAsync(s.Parish, group.Id, meeting.Id, new AttendanceOpenDto
        { OperationId = Guid.NewGuid(), MeetingVersion = (await meetings.GetAsync(s.Parish, group.Id, meeting.Id, default)).Version }, default);
        while (!sheet.Value.SnapshotComplete)
            sheet = await Service(f).AdvanceSnapshotAsync(s.Parish, group.Id, meeting.Id, new AttendanceSnapshotDto { OperationId = Guid.NewGuid(), Version = sheet.Version }, default);
        return new(s, group.Id, meeting.Id, member.PersonId);
    }
    private static async Task<AttendanceGuestDto> Request(GuestScenario s, string person)
    {
        // Read with the caller's explicit capacity; changing AsyncLocal HTTP context inside this helper clears its caller's fixture context.
        return new AttendanceGuestDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await Service(s.Scope.Fixture).GetAsync(s.Scope.Parish, s.Group, s.Meeting, default)).Version,
            PersonId = Guid.Parse(person),
            IdentityReviewReference = "Isolated protected identity admission evidence",
            Reason = "Isolated protected additional-person review reason"
        };
    }
    private static async Task ChangeSheet(GuestScenario s, Action<AttendanceSheet> mutate)
    {
        var records = Records(s.Scope.Fixture);
        var key = "attendanceSheet:" + s.Meeting;
        var row = (await records.ReadAsync<AttendanceSheet>(Area(s), key, default))!;
        mutate(row.Value);
        await records.CommitAsync(Area(s), Operation.Create(Guid.NewGuid(), s.Scope.Fixture.Other, new { isolatedLegacyFixture = s.Meeting }, s.Scope.Fixture.Clock),
            "test.legacy_guest_capture", s.Meeting, [RecordChange.Replace(key, "attendanceSheet", row.Value, row.Version)], new CommandResult { Id = s.Meeting }, default);
    }
    private sealed class EmptyGuestPageRecords(IRecordTransactions inner) : IRecordTransactions
    {
        public Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct) => inner.ReadAsync<T>(scope, id, ct);
        public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct, params RecordCondition[] conditions)
        {
            // A Cosmos service page may be empty while its token still points to later records.
            if (type == "attendanceRow" && conditions.Any(x => x.Path == "participantKind" && Equals(x.Value, "Guest")))
                return Task.FromResult(new Page<Versioned<T>> { Items = [], ContinuationToken = "isolated-nonterminal-guest-page" });
            return inner.PageAsync<T>(scope, type, size, continuation, ct, conditions);
        }
        public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
            => inner.ScanWorkAsync<T>(area, type, size, continuation, ct);
        public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class
            => inner.ReplayAsync<T>(scope, operation, ct);
        public Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId, IReadOnlyList<RecordChange> changes,
            T result, CancellationToken ct, string? reason = null) where T : class
            => inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
    }

    private sealed record GuestScenario(MinistryScenario Scope, string Group, string Meeting, string Member);
    private static RecordScope Area(GuestScenario s) => MinistryAccess.Scope(s.Scope.Parish);
    private static MinistryAttendanceService Service(LocalBackendFixture f) => f.Services.GetRequiredService<MinistryAttendanceService>();
    private static IRecordTransactions Records(LocalBackendFixture f) => f.Services.GetRequiredService<IRecordTransactions>();
    private static async Task Csrf(HttpClient client)
    {
        var state = await Read<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", state.GetProperty("token").GetString());
    }
    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
