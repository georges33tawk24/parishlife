// Purpose: records actual ministry-meeting attendance using resumable dated-roster snapshots, scoped duties and attributable corrections.
// Main functions: OpenAsync, AdvanceSnapshotAsync, GetAsync, GridAsync, RecordAsync, CloseAsync, CorrectAsync, OwnAsync and HistoryAsync;
// helpers preserve exact source ownership, conditional counters, current authorization and protected review evidence independently from RSVP.

using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public class MinistryAttendanceService(IRecordTransactions records, MinistryAccess access, ICurrentActor actor,
    IDataProtectionProvider protection, TimeProvider clock)
{
    private const int SnapshotPageSize = 40;
    private static readonly HashSet<string> Statuses = new(StringComparer.Ordinal)
        { "Present", "Late", "Absent", "Excused", "NotExpected", "NotRecorded" };

    public async Task<Versioned<AttendanceSheetDto>> OpenAsync(string parish, string ministry, string meetingId,
        AttendanceOpenDto request, CancellationToken ct)
    {
        var root = await access.RootAsync(parish, ct);
        var group = await access.RequireAttendanceAsync(parish, ministry, ct, requireModule: false);
        var source = await SourceAsync(parish, ministry, meetingId, ct, true);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-attendance-open:v1:" + ministry + ":" + meetingId);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await GetAsync(parish, ministry, meetingId, ct);
        await access.ModuleAsync(parish, ct);
        if (await records.ReadAsync<AttendanceSheet>(scope, SheetKey(meetingId), ct) is not null)
            throw State("This meeting already has an attendance sheet; resume its actual saved state.");
        var value = new AttendanceSheet
        {
            Id = meetingId, ParishId = parish, MinistryId = ministry, MeetingId = meetingId, EventId = source.Meeting.Value.EventId,
            MeetingStartsAt = source.Meeting.Value.StartsAt, MeetingEndsAt = source.Meeting.Value.EndsAt,
            TimeZone = source.Meeting.Value.TimeZone, CreatedAt = op.At, CreatedBy = actor.AccountId
        };
        var changes = Fences(root, group, source);
        changes[2] = RecordChange.Replace("ministryMeeting:" + meetingId, "ministryMeeting", source.Meeting.Value, Versions.Require(request.MeetingVersion));
        changes.Add(RecordChange.Create(SheetKey(meetingId), "attendanceSheet", value));
        changes.Add(Change(value, "open", null, null, "Building", op, null, null));
        await RecheckAsync(parish, ministry, false, true, ct);
        await records.CommitAsync(scope, op, "ministry.attendance_open", meetingId, changes, Result(value), ct);
        return await GetAsync(parish, ministry, meetingId, ct);
    }

    public async Task<Versioned<AttendanceSheetDto>> AdvanceSnapshotAsync(string parish, string ministry, string meetingId,
        AttendanceSnapshotDto request, CancellationToken ct)
    {
        var root = await access.RootAsync(parish, ct);
        var group = await access.RequireAttendanceAsync(parish, ministry, ct, requireModule: false);
        var source = await SourceAsync(parish, ministry, meetingId, ct, true);
        var row = await ReadSheetAsync(parish, ministry, meetingId, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-attendance-snapshot:v1:" + ministry + ":" + meetingId);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await GetAsync(parish, ministry, meetingId, ct);
        var value = row.Value;
        EnsureSource(value, source.Meeting.Value);
        if (value.Status != "Building") throw State("Only an incomplete expected-roster snapshot may advance.");
        var changes = Fences(root, group, source);
        if (value.SnapshotPhase == "MembershipValidation")
        {
            var members = await records.PageAsync<MinistryMembership>(scope, "ministryMembership", SnapshotPageSize,
                value.SnapshotCursor, ct, Equal("ministryId", ministry));
            foreach (var member in members.Items)
                await ValidateCurrentPeriodAsync(parish, ministry, member.Value, ct);
            value.SnapshotCursor = members.ContinuationToken;
            if (value.SnapshotCursor is null) value.SnapshotPhase = "PeriodSnapshot";
        }
        else if (value.SnapshotPhase == "PeriodSnapshot")
        {
            var periods = await records.PageAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod", SnapshotPageSize,
                value.SnapshotCursor, ct, Equal("ministryId", ministry),
                new RecordCondition { Path = "joinedAt", Comparison = "lte", Value = value.MeetingStartsAt });
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var period in periods.Items)
            {
                ValidatePeriod(ministry, period.Value);
                if (period.Value.JoinedAt > value.MeetingStartsAt || period.Value.LeftAt is { } left && left <= value.MeetingStartsAt) continue;
                var person = period.Value.PersonId;
                if (!seen.Add(person) || await records.ReadAsync<AttendanceRow>(scope, RowKey(meetingId, person), ct) is not null)
                    throw Review("Overlapping membership periods require review; an incomplete snapshot is never presented as ready.");
                var item = new AttendanceRow
                {
                    Id = meetingId + ":" + person, ParishId = parish, MinistryId = ministry, MeetingId = meetingId,
                    PersonId = person, MembershipPeriodId = period.Value.Id
                };
                changes.Add(RecordChange.Create(RowKey(meetingId, person), "attendanceRow", item));
                value.ExpectedCount = checked(value.ExpectedCount + 1);
                value.NotRecordedCount = checked(value.NotRecordedCount + 1);
            }
            value.SnapshotCursor = periods.ContinuationToken;
            if (value.SnapshotCursor is null)
            {
                value.SnapshotPhase = "Complete"; value.Status = "Ready"; value.SnapshotCompletedAt = op.At;
            }
        }
        else throw Review("This snapshot phase needs an explicit compatible recovery review.");
        value.SnapshotPages = checked(value.SnapshotPages + 1);
        ValidateCounters(value);
        changes.Add(RecordChange.Replace(SheetKey(meetingId), "attendanceSheet", value, Versions.Require(request.Version)));
        changes.Add(Change(value, "snapshot", null, "Building", value.Status, op, null, null));
        await RecheckAsync(parish, ministry, false, false, ct);
        await records.CommitAsync(scope, op, "ministry.attendance_snapshot", meetingId, changes, Result(value), ct);
        return await GetAsync(parish, ministry, meetingId, ct);
    }

    public async Task<Versioned<AttendanceSheetDto>> GetAsync(string parish, string ministry, string meetingId, CancellationToken ct)
    {
        await RequireReaderAsync(parish, ministry, ct);
        var source = await SourceAsync(parish, ministry, meetingId, ct, false);
        var row = await ReadSheetAsync(parish, ministry, meetingId, ct);
        EnsureSource(row.Value, source.Meeting.Value);
        return new() { Value = View(row.Value, source.Meeting.Value.Status == "Cancelled"), Version = row.Version };
    }

    public async Task<AttendanceRowsDto> GridAsync(string parish, string ministry, string meetingId, int size, string? cursor, CancellationToken ct)
    {
        await RequireReaderAsync(parish, ministry, ct);
        var source = await SourceAsync(parish, ministry, meetingId, ct, false);
        var sheet = await ReadSheetAsync(parish, ministry, meetingId, ct);
        EnsureSource(sheet.Value, source.Meeting.Value);
        RequireComplete(sheet.Value);
        var page = await records.PageAsync<AttendanceRow>(MinistryAccess.Scope(parish), "attendanceRow", size, cursor, ct,
            Equal("ministryId", ministry), Equal("meetingId", meetingId));
        foreach (var row in page.Items) ValidateRow(parish, ministry, meetingId, row.Value);
        if ((await ReadSheetAsync(parish, ministry, meetingId, ct)).Version != sheet.Version)
            throw State("Attendance changed while reading this page; reload the current summary and rows.");
        return new()
        {
            Sheet = new() { Value = View(sheet.Value, source.Meeting.Value.Status == "Cancelled"), Version = sheet.Version },
            Items = page.Items.Select(row => new Versioned<AttendanceValueDto> { Value = RowView(row.Value), Version = row.Version }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<Versioned<AttendanceSheetDto>> RecordAsync(string parish, string ministry, string meetingId, AttendanceWriteDto request, CancellationToken ct)
    {
        var root = await access.RootAsync(parish, ct);
        var group = await access.RequireAttendanceAsync(parish, ministry, ct, requireModule: false);
        var source = await SourceAsync(parish, ministry, meetingId, ct, true);
        var sheet = await ReadSheetAsync(parish, ministry, meetingId, ct);
        EnsureSource(sheet.Value, source.Meeting.Value);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-attendance-record:v1:" + ministry + ":" + meetingId);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await GetAsync(parish, ministry, meetingId, ct);
        await access.ModuleAsync(parish, ct);
        if (sheet.Value.Status != "Ready") throw State("Complete the expected-roster snapshot first; closed sheets require a reviewed correction.");
        if (request.Entries is null || request.Entries.Length is < 1 or > 25 || request.Entries.Any(x => x is null)
            || request.Entries.Select(x => x.PersonId).Distinct().Count() != request.Entries.Length)
            throw new DomainException("invalid_attendance_batch", "Record 1–25 distinct explicit attendance rows.");
        var changes = Fences(root, group, source);
        foreach (var entry in request.Entries)
        {
            var person = Guard.Id(entry.PersonId);
            RequireStatus(entry.Status);
            var row = await records.ReadAsync<AttendanceRow>(scope, RowKey(meetingId, person), ct) ?? throw MinistryAccess.Missing();
            ValidateRow(parish, ministry, meetingId, row.Value);
            if (row.Value.Status == entry.Status) throw State("Submit only actual attendance changes; unchanged values are not new observations.");
            var reason = row.Value.RecordedAt is null ? Optional(entry.CorrectionReason, "Observation reason", 2000)
                : Guard.Text(entry.CorrectionReason, "Actual correction reason", 2000);
            var previous = row.Value.Status;
            Adjust(sheet.Value, previous, -1); Adjust(sheet.Value, entry.Status, 1);
            row.Value.Status = entry.Status; row.Value.RecordedAt = op.At; row.Value.RecordedBy = actor.AccountId;
            changes.Add(RecordChange.Replace(RowKey(meetingId, person), "attendanceRow", row.Value, Versions.Require(entry.Version)));
            changes.Add(Change(sheet.Value, "record", person, previous, entry.Status, op, reason, null));
        }
        ValidateCounters(sheet.Value);
        changes.Add(RecordChange.Replace(SheetKey(meetingId), "attendanceSheet", sheet.Value, Versions.Require(request.Version)));
        await RecheckAsync(parish, ministry, false, true, ct);
        await records.CommitAsync(scope, op, "ministry.attendance_record", meetingId, changes, Result(sheet.Value), ct);
        return await GetAsync(parish, ministry, meetingId, ct);
    }

    public async Task<Versioned<AttendanceSheetDto>> CloseAsync(string parish, string ministry, string meetingId, AttendanceCloseDto request, CancellationToken ct)
    {
        var root = await access.RootAsync(parish, ct);
        var group = await access.RequireAttendanceAsync(parish, ministry, ct, review: true, requireModule: false);
        var source = await SourceAsync(parish, ministry, meetingId, ct, true);
        var row = await ReadSheetAsync(parish, ministry, meetingId, ct);
        EnsureSource(row.Value, source.Meeting.Value);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-attendance-close:v1:" + ministry + ":" + meetingId);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await ReviewerViewAsync(parish, ministry, meetingId, ct);
        if (row.Value.Status != "Ready") throw State("Close only a fully built ready sheet; unknown attendance remains unknown on closure.");
        var reason = Guard.Text(request.Reason, "Reporting closure reason", 2000);
        var reference = Guard.Text(request.ReportingReference, "Actual reporting review reference", 1000);
        row.Value.Status = "Closed"; row.Value.ClosedAt = op.At; row.Value.ClosedBy = actor.AccountId;
        row.Value.ProtectedReportingReference = Protector(parish, meetingId, "closure-reference").Protect(reference);
        row.Value.ProtectedCloseReason = Protector(parish, meetingId, "closure-reason").Protect(reason);
        var changes = Fences(root, group, source);
        changes.Add(RecordChange.Replace(SheetKey(meetingId), "attendanceSheet", row.Value, Versions.Require(request.Version)));
        changes.Add(Change(row.Value, "close", null, "Ready", "Closed", op, reason, reference));
        await RecheckAsync(parish, ministry, true, false, ct);
        await records.CommitAsync(scope, op, "ministry.attendance_close", meetingId, changes, Result(row.Value), ct);
        return await ReviewerViewAsync(parish, ministry, meetingId, ct);
    }

    public async Task<Versioned<AttendanceSheetDto>> CorrectAsync(string parish, string ministry, string meetingId, AttendanceCorrectDto request, CancellationToken ct)
    {
        var root = await access.RootAsync(parish, ct);
        var group = await access.RequireAttendanceAsync(parish, ministry, ct, review: true, requireModule: false);
        var source = await SourceAsync(parish, ministry, meetingId, ct, true);
        var sheet = await ReadSheetAsync(parish, ministry, meetingId, ct);
        EnsureSource(sheet.Value, source.Meeting.Value);
        var scope = MinistryAccess.Scope(parish);
        var person = Guard.Id(request.PersonId);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-attendance-correct:v1:" + ministry + ":" + meetingId + ":" + person);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await ReviewerViewAsync(parish, ministry, meetingId, ct);
        if (sheet.Value.Status != "Closed") throw State("Use ordinary recorded changes before closure; this route amends a closed sheet only.");
        RequireStatus(request.Status);
        var row = await records.ReadAsync<AttendanceRow>(scope, RowKey(meetingId, person), ct) ?? throw MinistryAccess.Missing();
        ValidateRow(parish, ministry, meetingId, row.Value);
        if (row.Value.Status == request.Status) throw State("A reviewed correction must identify an actual status change.");
        var reason = Guard.Text(request.Reason, "Actual correction reason", 2000);
        var reference = Guard.Text(request.ReviewReference, "Actual eligible review reference", 1000);
        var previous = row.Value.Status;
        Adjust(sheet.Value, previous, -1); Adjust(sheet.Value, request.Status, 1); ValidateCounters(sheet.Value);
        row.Value.Status = request.Status; row.Value.RecordedBy = actor.AccountId; row.Value.RecordedAt = op.At;
        var changes = Fences(root, group, source);
        changes.Add(RecordChange.Replace(SheetKey(meetingId), "attendanceSheet", sheet.Value, Versions.Require(request.Version)));
        changes.Add(RecordChange.Replace(RowKey(meetingId, person), "attendanceRow", row.Value, Versions.Require(request.RowVersion)));
        changes.Add(Change(sheet.Value, "correct-closed", person, previous, request.Status, op, reason, reference));
        await RecheckAsync(parish, ministry, true, false, ct);
        await records.CommitAsync(scope, op, "ministry.attendance_correct", meetingId, changes, Result(sheet.Value), ct);
        return await ReviewerViewAsync(parish, ministry, meetingId, ct);
    }

    public async Task<AttendanceValueDto> OwnAsync(string parish, string ministry, string meetingId, CancellationToken ct)
    {
        var link = await access.OwnLinkAsync(parish, ct);
        var source = await SourceAsync(parish, ministry, meetingId, ct, false);
        var sheet = await ReadSheetAsync(parish, ministry, meetingId, ct);
        EnsureSource(sheet.Value, source.Meeting.Value); RequireComplete(sheet.Value);
        var row = await records.ReadAsync<AttendanceRow>(MinistryAccess.Scope(parish), RowKey(meetingId, link.Value.PersonId), ct) ?? throw MinistryAccess.Missing();
        ValidateRow(parish, ministry, meetingId, row.Value);
        return RowView(row.Value);
    }

    public async Task<Page<AttendanceChangeDto>> HistoryAsync(string parish, string ministry, string meetingId, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireAttendanceAsync(parish, ministry, ct, review: true, requireModule: false);
        await SourceAsync(parish, ministry, meetingId, ct, false);
        await ReadSheetAsync(parish, ministry, meetingId, ct);
        var page = await records.PageAsync<AttendanceChange>(MinistryAccess.Scope(parish), "attendanceChange", size, cursor, ct,
            Equal("ministryId", ministry), Equal("meetingId", meetingId));
        return new()
        {
            Items = page.Items.Select(row => ChangeView(parish, meetingId, row.Value)).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    private async Task<Versioned<AttendanceSheetDto>> ReviewerViewAsync(string parish, string ministry, string meetingId, CancellationToken ct)
    {
        await access.RequireAttendanceAsync(parish, ministry, ct, review: true, requireModule: false);
        var source = await SourceAsync(parish, ministry, meetingId, ct, false);
        var row = await ReadSheetAsync(parish, ministry, meetingId, ct);
        EnsureSource(row.Value, source.Meeting.Value);
        return new() { Value = View(row.Value, source.Meeting.Value.Status == "Cancelled"), Version = row.Version };
    }

    private async Task RequireReaderAsync(string parish, string ministry, CancellationToken ct)
        => _ = await access.RequireAttendanceAsync(parish, ministry, ct, requireModule: false, readOnly: true);

    private async Task RecheckAsync(string parish, string ministry, bool review, bool requireModule, CancellationToken ct)
        => _ = await access.RequireAttendanceAsync(parish, ministry, ct, review, requireModule);

    private async Task<(Versioned<MinistryMeeting> Meeting, Versioned<CalendarEvent> Calendar)> SourceAsync(
        string parish, string ministry, string id, CancellationToken ct, bool mutation)
    {
        await access.RootAsync(parish, ct);
        var meeting = await records.ReadAsync<MinistryMeeting>(MinistryAccess.Scope(parish), "ministryMeeting:" + id, ct)
            ?? throw MinistryAccess.Missing();
        var value = meeting.Value;
        if (value.Id != id || value.ParishId != parish || value.MinistryId != ministry || value.Visibility != "Ministry"
            || value.StartsAt == default || value.EndsAt <= value.StartsAt || value.StartsAt.Offset != TimeSpan.Zero
            || value.EndsAt.Offset != TimeSpan.Zero || value.EndsAt > clock.GetUtcNow()
            || value.Status is not ("Confirmed" or "Cancelled") || mutation && value.Status != "Confirmed")
            throw State("Attendance belongs to an actual completed confirmed ministry meeting, independently from RSVP; cancelled occurrences have no ordinary denominator.");
        var calendar = await records.ReadAsync<CalendarEvent>(MinistryAccess.Scope(parish), "event:" + value.EventId, ct)
            ?? throw MinistryAccess.Missing();
        var item = calendar.Value;
        if (item.Id != value.EventId || item.ParishId != parish || item.SourceType != "MinistryMeeting" || item.Kind != "MinistryMeeting"
            || item.SourceId != id || item.MinistryId != ministry || item.Visibility != "Ministry" || item.Published
            || item.StartsAt != value.StartsAt || item.EndsAt != value.EndsAt || item.TimeZone != value.TimeZone
            || item.Status != value.Status || item.Title != value.Title || item.ClergyAccountIds?.Length is > 0)
            throw Review("The exact ministry meeting/calendar ownership needs review before attendance is read or changed.");
        return (meeting, calendar);
    }

    private async Task<Versioned<AttendanceSheet>> ReadSheetAsync(string parish, string ministry, string meeting, CancellationToken ct)
    {
        var row = await records.ReadAsync<AttendanceSheet>(MinistryAccess.Scope(parish), SheetKey(meeting), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != meeting || row.Value.MeetingId != meeting || row.Value.ParishId != parish || row.Value.MinistryId != ministry)
            throw MinistryAccess.Missing();
        ValidateCounters(row.Value);
        return row;
    }

    private async Task ValidateCurrentPeriodAsync(string parish, string ministry, MinistryMembership member, CancellationToken ct)
    {
        if (member.MinistryId != ministry || !CanonicalId(member.PersonId) || string.IsNullOrWhiteSpace(member.PeriodId))
            throw Review("A legacy or mismatched membership needs an evidenced period review before historical attendance is snapshotted.");
        var period = await records.ReadAsync<MinistryMembershipPeriod>(MinistryAccess.Scope(parish), "ministryMembershipPeriod:" + member.PeriodId, ct);
        if (period is null) throw Review("A membership's actual dated period is missing; it cannot be inferred from the current roster.");
        ValidatePeriod(ministry, period.Value);
        if (period.Value.Id != member.PeriodId || period.Value.PersonId != member.PersonId
            || period.Value.JoinedAt != member.JoinedAt || period.Value.LeftAt != member.LeftAt)
            throw Review("The current membership and its dated period differ and need review.");
    }

    private static void ValidatePeriod(string ministry, MinistryMembershipPeriod value)
    {
        if (value.MinistryId != ministry || !CanonicalId(value.Id) || !CanonicalId(value.PersonId)
            || !CanonicalId(value.JoinApplicationId) || string.IsNullOrWhiteSpace(value.ApprovedBy)
            || value.JoinedAt == default || value.JoinedAt.Offset != TimeSpan.Zero
            || value.LeftAt is { } last && (last.Offset != TimeSpan.Zero || last < value.JoinedAt))
            throw Review("An unsupported dated membership period needs explicit review before it contributes to an expected roster.");
    }

    private static void EnsureSource(AttendanceSheet sheet, MinistryMeeting meeting)
    {
        if (sheet.EventId != meeting.EventId || sheet.MeetingStartsAt != meeting.StartsAt || sheet.MeetingEndsAt != meeting.EndsAt
            || sheet.TimeZone != meeting.TimeZone || sheet.MinistryId != meeting.MinistryId || sheet.ParishId != meeting.ParishId)
            throw Review("The recorded occurrence snapshot differs from its source; do not rewrite historical attendance silently.");
    }

    private static List<RecordChange> Fences(Versioned<Parish> root, Versioned<Ministry> group,
        (Versioned<MinistryMeeting> Meeting, Versioned<CalendarEvent> Calendar) source) =>
        [MinistryAccess.Fence(root), RecordChange.Replace("ministry:" + group.Value.Id, "ministry", group.Value, group.Version),
         RecordChange.Replace("ministryMeeting:" + source.Meeting.Value.Id, "ministryMeeting", source.Meeting.Value, source.Meeting.Version),
         RecordChange.Replace("event:" + source.Calendar.Value.Id, "event", source.Calendar.Value, source.Calendar.Version)];

    private RecordChange Change(AttendanceSheet sheet, string action, string? person, string? previous, string next,
        Operation op, string? reason, string? reference)
    {
        var id = op.Id + (person is null ? string.Empty : ":" + person);
        return RecordChange.Create("attendanceChange:" + id, "attendanceChange", new AttendanceChange
        {
            Id = id, ParishId = sheet.ParishId, MinistryId = sheet.MinistryId, MeetingId = sheet.MeetingId,
            Action = action, PersonId = person, PreviousStatus = previous, NewStatus = next, ActorId = actor.AccountId,
            ActingAppointmentId = actor.ActingAppointmentId, RecordedAt = op.At,
            ProtectedReason = reason is null ? null : Protector(sheet.ParishId, sheet.MeetingId, id + ":reason").Protect(reason),
            ProtectedReference = reference is null ? null : Protector(sheet.ParishId, sheet.MeetingId, id + ":reference").Protect(reference),
            ExpectedCount = sheet.ExpectedCount, PresentCount = sheet.PresentCount, LateCount = sheet.LateCount,
            AbsentCount = sheet.AbsentCount, ExcusedCount = sheet.ExcusedCount,
            NotExpectedCount = sheet.NotExpectedCount, NotRecordedCount = sheet.NotRecordedCount
        });
    }

    private AttendanceChangeDto ChangeView(string parish, string meeting, AttendanceChange value)
    {
        if (value.ParishId != parish || value.MeetingId != meeting) throw MinistryAccess.Missing();
        return new()
        {
            Id = value.Id, MeetingId = value.MeetingId, Action = value.Action, PersonId = value.PersonId,
            PreviousStatus = value.PreviousStatus, NewStatus = value.NewStatus, ActorId = value.ActorId,
            ActingAppointmentId = value.ActingAppointmentId, RecordedAt = value.RecordedAt,
            Reason = Unprotect(parish, meeting, value.Id + ":reason", value.ProtectedReason),
            ReviewReference = Unprotect(parish, meeting, value.Id + ":reference", value.ProtectedReference),
            ExpectedCount = value.ExpectedCount, PresentCount = value.PresentCount, LateCount = value.LateCount,
            AbsentCount = value.AbsentCount, ExcusedCount = value.ExcusedCount,
            NotExpectedCount = value.NotExpectedCount, NotRecordedCount = value.NotRecordedCount
        };
    }

    private static AttendanceSheetDto View(AttendanceSheet value, bool cancelled)
    {
        var complete = value.Status is "Ready" or "Closed";
        var denominator = !complete || cancelled ? 0 : value.ExpectedCount - value.NotExpectedCount;
        var recorded = value.PresentCount + value.LateCount + value.AbsentCount + value.ExcusedCount;
        return new()
        {
            MeetingId = value.MeetingId, MinistryId = value.MinistryId, Status = value.Status, SnapshotPhase = value.SnapshotPhase,
            SnapshotPages = value.SnapshotPages, MeetingStartsAt = value.MeetingStartsAt, MeetingEndsAt = value.MeetingEndsAt,
            TimeZone = value.TimeZone, SnapshotCompletedAt = value.SnapshotCompletedAt, ClosedAt = value.ClosedAt,
            MetricDefinition = value.MetricDefinition, ExpectedCount = value.ExpectedCount, PresentCount = value.PresentCount,
            LateCount = value.LateCount, AbsentCount = value.AbsentCount, ExcusedCount = value.ExcusedCount,
            NotExpectedCount = value.NotExpectedCount, NotRecordedCount = value.NotRecordedCount,
            GuestCount = 0, Denominator = denominator, PresentOrLate = value.PresentCount + value.LateCount,
            RecordedExpected = cancelled || !complete ? 0 : recorded, SnapshotComplete = complete, CancelledOccurrence = cancelled,
            CoveragePercent = denominator == 0 ? null : decimal.Round(100m * recorded / denominator, 2, MidpointRounding.AwayFromZero),
            PresentOrLatePercent = denominator == 0 ? null : decimal.Round(100m * (value.PresentCount + value.LateCount) / denominator, 2, MidpointRounding.AwayFromZero)
        };
    }

    private static AttendanceValueDto RowView(AttendanceRow value) => new()
    { MeetingId = value.MeetingId, PersonId = value.PersonId, ParticipantKind = value.ParticipantKind, Status = value.Status, RecordedAt = value.RecordedAt };

    private static void ValidateRow(string parish, string ministry, string meeting, AttendanceRow value)
    {
        if (value.ParishId != parish || value.MinistryId != ministry || value.MeetingId != meeting || !CanonicalId(value.PersonId)
            || value.ParticipantKind != "Member" || !CanonicalId(value.MembershipPeriodId) || !Statuses.Contains(value.Status))
            throw Review("An attendance row has incompatible identity, audience or state and needs review.");
    }

    private static void Adjust(AttendanceSheet sheet, string status, int delta)
    {
        switch (status)
        {
            case "Present": sheet.PresentCount = checked(sheet.PresentCount + delta); break;
            case "Late": sheet.LateCount = checked(sheet.LateCount + delta); break;
            case "Absent": sheet.AbsentCount = checked(sheet.AbsentCount + delta); break;
            case "Excused": sheet.ExcusedCount = checked(sheet.ExcusedCount + delta); break;
            case "NotExpected": sheet.NotExpectedCount = checked(sheet.NotExpectedCount + delta); break;
            case "NotRecorded": sheet.NotRecordedCount = checked(sheet.NotRecordedCount + delta); break;
            default: throw Review("Unsupported attendance state requires review rather than conversion into absence.");
        }
    }

    private static void ValidateCounters(AttendanceSheet value)
    {
        var counts = new[] { value.PresentCount, value.LateCount, value.AbsentCount, value.ExcusedCount, value.NotExpectedCount, value.NotRecordedCount };
        if (value.ExpectedCount < 0 || counts.Any(x => x < 0) || counts.Sum(x => (long)x) != value.ExpectedCount)
            throw Review("The saved attendance counters need reconciliation before this sheet can be read or changed.");
    }

    private static void RequireComplete(AttendanceSheet value)
    {
        if (value.Status is not ("Ready" or "Closed") || value.SnapshotPhase != "Complete")
            throw State("The roster snapshot is incomplete; resume its stored cursor before using the grid.");
    }

    private IDataProtector Protector(string parish, string meeting, string field)
        => protection.CreateProtector("ParishLife.MinistryAttendance.v1", parish, meeting, field);
    private string? Unprotect(string parish, string meeting, string field, string? value)
    {
        if (value is null) return null;
        try { return Protector(parish, meeting, field).Unprotect(value); }
        catch (CryptographicException) { throw new DomainException("attendance_evidence_unavailable", "The protected review record cannot currently be read.", FailureKind.Unavailable); }
    }
    private static bool CanonicalId(string value) => Guid.TryParse(value, out var id) && id != Guid.Empty && id.ToString("N") == value;
    private static string? Optional(string? value, string name, int maximum) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, name, maximum);
    private static string SheetKey(string meeting) => "attendanceSheet:" + meeting;
    private static string RowKey(string meeting, string person) => "attendanceRow:" + meeting + ":" + person;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static CommandResult Result(AttendanceSheet value) => new() { Id = value.MeetingId, Status = value.Status };
    private static void RequireStatus(string value)
    {
        if (!Statuses.Contains(value)) throw new DomainException("invalid_attendance_status", "Use Present, Late, Absent, Excused, NotExpected or NotRecorded.");
    }
    private static DomainException State(string message) => new("invalid_attendance_state", message, FailureKind.Conflict);
    private static DomainException Review(string message) => new("attendance_roster_review_required", message, FailureKind.Conflict);
}
