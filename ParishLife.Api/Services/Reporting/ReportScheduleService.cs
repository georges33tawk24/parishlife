// Purpose: lets a current MFA account (personal capacity only, never a recovery session) schedule in-app delivery of the parish work overview
// to itself, pause/resume/cancel it, list its deliveries and read a delivered snapshot. Creating or resuming requires current access; every
// snapshot read rechecks the reader's current permission per queue. Email copies are recorded as not configured and never claimed as sent.
// Main functions: CreateAsync, ListAsync, ActAsync, DeliveriesAsync, DeliveryAsync; Next computes the next local run time.

using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Reporting;

public class ReportScheduleService(IRecordTransactions records, WorkOverviewService overview, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    internal const string WorkOverview = "work-overview";
    internal const string EmailNotConfigured = "NotConfigured";
    private static readonly string[] Days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    private RecordScope Own => new() { Area = RecordArea.Account, OwnerId = actor.AccountId };
    private static DomainException Missing() => new("resource_not_found", "The requested report is unavailable.", FailureKind.NotFound);

    private async Task RequireAsync(CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        // The runner re-evaluates direct parish grants only, so a schedule never runs under a selected organizational appointment.
        if (actor.ActingAppointmentId is not null)
            throw new DomainException("personal_capacity_required", "Leave the selected appointment to manage your own report schedules.", FailureKind.Forbidden);
    }

    public async Task<Versioned<ReportScheduleDto>> CreateAsync(CreateReportScheduleDto request, CancellationToken ct)
    {
        await RequireAsync(ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "report-schedule:v1");
        if (await records.ReplayAsync<CommandResult>(Own, op, ct) is { } prior)
            return await GetAsync(prior.Id, ct);
        if (request.Report != WorkOverview)
            throw new DomainException("invalid_input", "Only the parish work overview can be scheduled.");
        var parish = Guard.Id(request.ParishId);
        var schedule = new ReportSchedule
        {
            Id = op.Id, AccountId = actor.AccountId, Report = WorkOverview, ParishId = parish, Frequency = request.Frequency, DayOfWeek = request.DayOfWeek,
            LocalHour = request.LocalHour, TimeZone = request.TimeZone?.Trim() ?? string.Empty, EmailRequested = request.Email, CreatedAt = op.At, UpdatedAt = op.At
        };
        Validate(schedule);
        // The creator must currently see at least one queue of this report.
        await overview.OverviewAsync(parish, ct);
        schedule.NextRunAt = Next(schedule, op.At);
        await records.CommitAsync(Own, op, "report.schedule_created", schedule.Id, [RecordChange.Create(Key(schedule.Id), "reportSchedule", schedule)],
            new CommandResult { Id = schedule.Id, Status = schedule.Status }, ct);
        return await GetAsync(schedule.Id, ct);
    }

    public async Task<Versioned<ReportScheduleDto>> GetAsync(string id, CancellationToken ct)
    {
        await RequireAsync(ct);
        var row = await records.ReadAsync<ReportSchedule>(Own, Key(id), ct);
        if (row is null || row.Value.AccountId != actor.AccountId)
            throw Missing();
        return new Versioned<ReportScheduleDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<Page<Versioned<ReportScheduleDto>>> ListAsync(int size, string? cursor, CancellationToken ct)
    {
        await RequireAsync(ct);
        var page = await records.PageAsync<ReportSchedule>(Own, "reportSchedule", size, cursor, ct);
        return new Page<Versioned<ReportScheduleDto>>
        {
            Items = [.. page.Items.Select(r => new Versioned<ReportScheduleDto> { Version = r.Version, Value = Project(r.Value) })], ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<Versioned<ReportScheduleDto>> ActAsync(string id, ReportScheduleActionDto request, CancellationToken ct)
    {
        await RequireAsync(ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "report-schedule-action:" + id);
        if (await records.ReplayAsync<CommandResult>(Own, op, ct) is not null)
            return await GetAsync(id, ct);
        var row = await records.ReadAsync<ReportSchedule>(Own, Key(id), ct);
        if (row is null || row.Value.AccountId != actor.AccountId)
            throw Missing();
        if (row.Version != request.Version)
            throw new DomainException("write_conflict", "The schedule changed; reload it first.", FailureKind.Conflict);
        var value = row.Value;
        switch (request.Action)
        {
            case "pause" when value.Status == "Active":
                value.Status = "Paused";
                value.StatusReason = string.IsNullOrWhiteSpace(request.Reason) ? "Paused by owner" : Guard.Text(request.Reason, "Reason", 500);
                break;
            case "resume" when value.Status == "Paused":
                await overview.OverviewAsync(value.ParishId, ct);
                value.Status = "Active";
                value.StatusReason = null;
                value.NextRunAt = Next(value, op.At);
                break;
            case "cancel" when value.Status is "Active" or "Paused":
                value.Status = "Cancelled";
                value.StatusReason = string.IsNullOrWhiteSpace(request.Reason) ? "Cancelled by owner" : Guard.Text(request.Reason, "Reason", 500);
                break;
            case "pause" or "resume" or "cancel":
                throw new DomainException("invalid_state", "The schedule cannot " + request.Action + " from " + value.Status + ".", FailureKind.Conflict);
            default:
                throw new DomainException("invalid_input", "Use pause, resume or cancel.");
        }
        value.UpdatedAt = op.At;
        await records.CommitAsync(Own, op, "report.schedule_" + request.Action, id, [RecordChange.Replace(Key(id), "reportSchedule", value, row.Version)],
            new CommandResult { Id = id, Status = value.Status }, ct);
        return await GetAsync(id, ct);
    }

    // Delivery metadata only; counts are shown by DeliveryAsync after a fresh permission check.
    public async Task<Page<ReportDeliveryDto>> DeliveriesAsync(int size, string? cursor, CancellationToken ct)
    {
        await RequireAsync(ct);
        var page = await records.PageAsync<ReportDelivery>(Own, "reportDelivery", size, cursor, ct);
        return new Page<ReportDeliveryDto> { Items = [.. page.Items.Select(r => Project(r.Value, []))], ContinuationToken = page.ContinuationToken };
    }

    public async Task<ReportDeliveryDto> DeliveryAsync(string id, CancellationToken ct)
    {
        await RequireAsync(ct);
        var row = await records.ReadAsync<ReportDelivery>(Own, "reportDelivery:" + id, ct);
        if (row is null || row.Value.AccountId != actor.AccountId)
            throw Missing();
        if (row.Value.Status != "StoredInApp")
            return Project(row.Value, []);
        var visible = new List<WorkCountDto>();
        foreach (var count in row.Value.Counts)
            if (await overview.AllowedAsync(row.Value.ParishId, count.Permission, ct))
                visible.Add(WorkOverviewService.Project(count));
        // Access lost since delivery: the snapshot is no longer shown, though its delivery record remains.
        if (visible.Count == 0)
            throw Missing();
        return Project(row.Value, [.. visible]);
    }

    internal static string Key(string id) => "reportSchedule:" + id;

    private static void Validate(ReportSchedule value)
    {
        if (value.Frequency is not ("Daily" or "Weekly"))
            throw new DomainException("invalid_input", "Use Daily or Weekly.");
        if (value.Frequency == "Weekly" != value.DayOfWeek is not null || value.DayOfWeek is not null && !Days.Contains(value.DayOfWeek))
            throw new DomainException("invalid_input", "Weekly schedules need a day of week (Monday..Sunday); daily schedules take none.");
        if (value.LocalHour is < 0 or > 23)
            throw new DomainException("invalid_input", "Use a local hour from 0 to 23.");
        if (value.TimeZone.Length is 0 or > 64 || !TimeZoneInfo.TryFindSystemTimeZoneById(value.TimeZone, out _))
            throw new DomainException("invalid_input", "Use a known IANA time zone such as Asia/Beirut.");
    }

    // The first matching local hour strictly after the given instant. A local hour skipped by a daylight-saving change runs an hour later.
    internal static DateTimeOffset Next(ReportSchedule schedule, DateTimeOffset after)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(schedule.TimeZone);
        var local = TimeZoneInfo.ConvertTime(after, zone);
        for (var offset = 0; offset <= 8; offset++)
        {
            var date = local.Date.AddDays(offset);
            if (schedule.DayOfWeek is { } day && date.DayOfWeek.ToString() != day)
                continue;
            var candidate = date.AddHours(schedule.LocalHour);
            if (zone.IsInvalidTime(candidate))
                candidate = candidate.AddHours(1);
            var utc = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(candidate, DateTimeKind.Unspecified), zone), TimeSpan.Zero);
            if (utc > after)
                return utc;
        }
        throw new InvalidOperationException("No next run within eight days.");
    }

    private static ReportScheduleDto Project(ReportSchedule x) => new()
    {
        Id = x.Id, Report = x.Report, ParishId = x.ParishId, Frequency = x.Frequency, DayOfWeek = x.DayOfWeek, LocalHour = x.LocalHour, TimeZone = x.TimeZone,
        Status = x.Status, StatusReason = x.StatusReason, NextRunAt = x.NextRunAt, LastRunAt = x.LastRunAt, EmailRequested = x.EmailRequested,
        EmailStatus = x.EmailRequested ? EmailNotConfigured : null, CreatedAt = x.CreatedAt
    };

    internal static ReportDeliveryDto Project(ReportDelivery x, WorkCountDto[] counts) => new()
    {
        Id = x.Id, ScheduleId = x.ScheduleId, Report = x.Report, ParishId = x.ParishId, ScheduledFor = x.ScheduledFor, ProducedAt = x.ProducedAt,
        Status = x.Status, ExternalChannel = x.ExternalChannel, ExternalStatus = x.ExternalStatus, Counts = counts
    };
}
