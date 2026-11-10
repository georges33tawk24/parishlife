// Purpose: manages private, manual parish CRM/follow-up for current personal MFA platform operators in one exact parish-specific Catalog partition.
// Main functions: GetAsync, SaveAsync, AddNoteAsync, EntryAsync, HistoryAsync and DueAsync preserve conditional writes, immutable history,
// protected note/reason text and exact retries; they never infer adoption, grant parish authority, inspect confidential modules or send outreach.

using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Administration;

public class ParishCrmService(IRecordTransactions records, IParishRepository parishes, IPlatformAccess platform,
    MfaAccountAccess proof, ICurrentActor actor, IDataProtectionProvider protection, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Platform, OwnerId = "crm:" + parish };
    private static string EntryKey(string id) => "parishCrmEntry:" + id;
    private IDataProtector Protector(string parish, string id) => protection.CreateProtector("ParishLife.ParishCrm.v1", parish, id);
    private static DomainException Missing() => new("resource_not_found", "The requested CRM resource is unavailable.", FailureKind.NotFound);

    private async Task RequireAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await platform.RequireOperatorAsync(ct);
        if (!Guid.TryParseExact(parish, "N", out var parsed) || parsed == Guid.Empty
            || (await parishes.GetAsync(parish, ct))?.Value.Id != parish) throw Missing();
    }

    public async Task<Versioned<ParishCrmDto>> GetAsync(string parish, CancellationToken ct)
    {
        await RequireAsync(parish, ct);
        var row = await ReadAsync(parish, ct);
        return new Versioned<ParishCrmDto> { Value = Project(row.Value), Version = row.Version };
    }

    public async Task<ParishCrmEntryDto> SaveAsync(string parish, ParishCrmSaveDto request, CancellationToken ct)
    {
        await RequireAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "parish-crm-save:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await ReadEntryAsync(parish, prior.Id, ct);
        var previous = await records.ReadAsync<ParishCrmRecord>(Scope(parish), "profile", ct);
        if (previous is not null && previous.Value.ParishId != parish) throw Missing();
        if (previous is null && request.Version is not null || previous is not null && previous.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The CRM record changed; reload it before saving.", FailureKind.Conflict);
        var assigned = request.AssignedOperatorAccountId is { } owner ? Guard.Id(owner) : null;
        if (assigned is not null && !await proof.IsEligibleOperatorAsync(assigned, ct))
            throw new DomainException("crm_operator_required", "Assign a currently eligible platform operator or leave the follow-up unassigned.");
        var next = string.IsNullOrWhiteSpace(request.NextAction) ? null : Guard.Text(request.NextAction, "Next action", 500);
        var at = request.FollowUpAt is { } due ? Guard.Utc(due) : (DateTimeOffset?)null;
        if (at is not null && next is null)
            throw new DomainException("invalid_input", "A dated follow-up needs an explicit next action.");
        var current = new ParishCrmRecord
        {
            ParishId = parish, TrackingStatus = Guard.Text(request.TrackingStatus, "Tracking status", 80), AssignedOperatorAccountId = assigned,
            NextAction = next, FollowUpAt = at, CreatedAt = previous?.Value.CreatedAt ?? op.At, UpdatedAt = op.At, UpdatedBy = actor.AccountId
        };
        var entry = new ParishCrmEntry
        {
            Id = op.Id, ParishId = parish, Kind = previous is null ? "Created" : "Updated", By = actor.AccountId, At = op.At,
            Previous = previous?.Value, Current = current, ProtectedReason = Protector(parish, op.Id).Protect(Guard.Text(request.Reason, "Reason", 1000))
        };
        // Authority/existence are rechecked before this independent platform partition commits; no cross-partition atomicity is implied.
        await RequireAsync(parish, ct);
        if (assigned is not null && !await proof.IsEligibleOperatorAsync(assigned, ct))
            throw new DomainException("crm_operator_required", "The assigned platform operator is no longer eligible.");
        await records.CommitAsync(Scope(parish), op, "crm.save", parish,
            [previous is null ? RecordChange.Create("profile", "parishCrmRecord", current)
                : RecordChange.Replace("profile", "parishCrmRecord", current, previous.Version),
             RecordChange.Create(EntryKey(entry.Id), "parishCrmEntry", entry)], new CommandResult { Id = entry.Id, Status = entry.Kind }, ct);
        return await ReadEntryAsync(parish, entry.Id, ct);
    }

    public async Task<ParishCrmEntryDto> AddNoteAsync(string parish, ParishCrmNoteDto request, CancellationToken ct)
    {
        await RequireAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "parish-crm-note:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await ReadEntryAsync(parish, prior.Id, ct);
        var row = await ReadAsync(parish, ct);
        if (row.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The CRM record changed; reload it before adding this note.", FailureKind.Conflict);
        var occurredAt = Guard.Utc(request.OccurredAt);
        if (occurredAt > op.At)
            throw new DomainException("invalid_input", "A manual note cannot claim a future occurrence.");
        var current = new ParishCrmRecord
        {
            ParishId = row.Value.ParishId, TrackingStatus = row.Value.TrackingStatus, AssignedOperatorAccountId = row.Value.AssignedOperatorAccountId,
            NextAction = row.Value.NextAction, FollowUpAt = row.Value.FollowUpAt, CreatedAt = row.Value.CreatedAt, UpdatedAt = op.At, UpdatedBy = actor.AccountId
        };
        var entry = new ParishCrmEntry
        {
            Id = op.Id, ParishId = parish, Kind = "Note", By = actor.AccountId, At = op.At, OccurredAt = occurredAt,
            Previous = row.Value, Current = current, ProtectedText = Protector(parish, op.Id).Protect(Guard.Text(request.Text, "Sanitized note", 2000))
        };
        await RequireAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, "crm.note", parish,
            [RecordChange.Replace("profile", "parishCrmRecord", current, row.Version), RecordChange.Create(EntryKey(entry.Id), "parishCrmEntry", entry)],
            new CommandResult { Id = entry.Id, Status = entry.Kind }, ct);
        return await ReadEntryAsync(parish, entry.Id, ct);
    }

    public async Task<ParishCrmEntryDto> EntryAsync(string parish, string id, CancellationToken ct)
    {
        await RequireAsync(parish, ct);
        return await ReadEntryAsync(parish, id, ct);
    }

    public async Task<Page<ParishCrmEntryDto>> HistoryAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await RequireAsync(parish, ct);
        var page = await records.PageAsync<ParishCrmEntry>(Scope(parish), "parishCrmEntry", size, cursor, ct);
        var entries = new List<ParishCrmEntryDto>();
        foreach (var row in page.Items)
        {
            if (row.Value.ParishId != parish) throw Missing();
            entries.Add(Project(row.Value));
        }
        return new Page<ParishCrmEntryDto> { Items = entries, ContinuationToken = page.ContinuationToken };
    }

    public async Task<Versioned<ParishCrmDto>?> DueAsync(string parish, CancellationToken ct)
    {
        await RequireAsync(parish, ct);
        var row = await records.ReadAsync<ParishCrmRecord>(Scope(parish), "profile", ct);
        if (row is null) return null;
        if (row.Value.ParishId != parish) throw Missing();
        return row.Value.FollowUpAt is { } due && due <= clock.GetUtcNow()
            ? new Versioned<ParishCrmDto> { Value = Project(row.Value), Version = row.Version } : null;
    }

    private async Task<Versioned<ParishCrmRecord>> ReadAsync(string parish, CancellationToken ct)
        => await records.ReadAsync<ParishCrmRecord>(Scope(parish), "profile", ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    private async Task<ParishCrmEntryDto> ReadEntryAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<ParishCrmEntry>(Scope(parish), EntryKey(id), ct);
        return row is not null && row.Value.Id == id && row.Value.ParishId == parish ? Project(row.Value) : throw Missing();
    }

    private static ParishCrmDto Project(ParishCrmRecord item) => new()
    {
        ParishId = item.ParishId, TrackingStatus = item.TrackingStatus, AssignedOperatorAccountId = item.AssignedOperatorAccountId,
        NextAction = item.NextAction, FollowUpAt = item.FollowUpAt, CreatedAt = item.CreatedAt, UpdatedAt = item.UpdatedAt, UpdatedBy = item.UpdatedBy
    };

    private ParishCrmEntryDto Project(ParishCrmEntry item) => new()
    {
        Id = item.Id, ParishId = item.ParishId, Kind = item.Kind, By = item.By, At = item.At, OccurredAt = item.OccurredAt,
        Previous = item.Previous is null ? null : Project(item.Previous), Current = Project(item.Current),
        Reason = item.ProtectedReason is null ? null : Protector(item.ParishId, item.Id).Unprotect(item.ProtectedReason),
        Text = item.ProtectedText is null ? null : Protector(item.ParishId, item.Id).Unprotect(item.ProtectedText)
    };
}
