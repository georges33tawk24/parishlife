// Purpose: a neutral, operator-maintained list of clergy titles and the title assigned to an account. The list starts empty: no title is
// seeded or invented, and a title grants no authority (appointments and office stay separate). Any signed-in account may read titles for display;
// only current MFA platform operators add, change, retire or assign them.
// Main functions: ListAsync, CreateAsync, UpdateAsync, AssignmentAsync and AssignAsync keep operation ids, versions and audit in one platform partition.

using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Administration;

public class ClergyTitleService(IRecordTransactions records, IPlatformAccess platform, MfaAccountAccess proof, ICurrentActor actor, TimeProvider clock)
{
    private static readonly RecordScope Scope = new() { Area = RecordArea.Platform, OwnerId = "clergy-titles" };
    private static string TitleKey(string id) => "clergyTitle:" + id;
    private static string AssignmentKey(string accountId) => "clergyTitleAssignment:" + accountId;
    private const int Maximum = 500;

    public async Task<IReadOnlyList<Versioned<ClergyTitleDto>>> ListAsync(bool includeRetired, CancellationToken ct)
        => (await AllAsync(ct)).Where(r => includeRetired || !r.Value.Retired)
            .OrderBy(r => r.Value.Title, StringComparer.CurrentCultureIgnoreCase).ThenBy(r => r.Value.Id, StringComparer.Ordinal)
            .Select(r => new Versioned<ClergyTitleDto> { Value = Project(r.Value), Version = r.Version }).ToArray();

    public async Task<Versioned<ClergyTitleDto>> CreateAsync(ClergyTitleSaveDto request, CancellationToken ct)
    {
        await RequireAsync(ct);
        if (request.Version is not null)
            throw new DomainException("invalid_input", "A new clergy title has no version.");
        var (title, titleAr) = Names(request);
        var op = actor.CreateOperation(request.OperationId, request, clock, "clergy-title-create:v1");
        if (await records.ReplayAsync<CommandResult>(Scope, op, ct) is { } prior)
            return await ReadAsync(prior.Id, ct);
        var value = new ClergyTitle
        {
            Id = op.Id, Title = title, TitleAr = titleAr, Retired = request.Retired,
            CreatedAt = op.At, CreatedBy = actor.AccountId, UpdatedAt = op.At, UpdatedBy = actor.AccountId
        };
        await records.CommitAsync(Scope, op, "clergy_title.created", value.Id, [RecordChange.Create(TitleKey(value.Id), "clergyTitle", value)],
            new CommandResult { Id = value.Id, Status = "Created" }, ct);
        return await ReadAsync(value.Id, ct);
    }

    public async Task<Versioned<ClergyTitleDto>> UpdateAsync(string id, ClergyTitleSaveDto request, CancellationToken ct)
    {
        await RequireAsync(ct);
        var (title, titleAr) = Names(request);
        var op = actor.CreateOperation(request.OperationId, request, clock, "clergy-title-update:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope, op, ct) is not null)
            return await ReadAsync(id, ct);
        var row = await ReadRowAsync(id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The clergy title changed; reload it before saving.", FailureKind.Conflict);
        var value = row.Value;
        value.Title = title;
        value.TitleAr = titleAr;
        value.Retired = request.Retired;
        value.UpdatedAt = op.At;
        value.UpdatedBy = actor.AccountId;
        await records.CommitAsync(Scope, op, "clergy_title.updated", id, [RecordChange.Replace(TitleKey(id), "clergyTitle", value, row.Version)],
            new CommandResult { Id = id, Status = "Updated" }, ct);
        return await ReadAsync(id, ct);
    }

    // Any signed-in account may read an account's title for display; an account with none (or an unknown id) reads as no title.
    public async Task<Versioned<ClergyTitleAssignmentDto>> AssignmentAsync(string accountId, CancellationToken ct)
    {
        var row = await records.ReadAsync<ClergyTitleAssignment>(Scope, AssignmentKey(accountId), ct);
        if (row is null || row.Value.AccountId != accountId)
            return new Versioned<ClergyTitleAssignmentDto> { Value = new ClergyTitleAssignmentDto { AccountId = accountId }, Version = string.Empty };
        var title = row.Value.ClergyTitleId is { } id ? (await records.ReadAsync<ClergyTitle>(Scope, TitleKey(id), ct))?.Value : null;
        return new Versioned<ClergyTitleAssignmentDto>
        {
            Value = new ClergyTitleAssignmentDto
            {
                AccountId = accountId, ClergyTitleId = title?.Id, Title = title?.Title, TitleAr = title?.TitleAr,
                AssignedAt = row.Value.AssignedAt, AssignedBy = row.Value.AssignedBy
            },
            Version = row.Version
        };
    }

    public async Task<Versioned<ClergyTitleAssignmentDto>> AssignAsync(string accountId, ClergyTitleAssignDto request, CancellationToken ct)
    {
        await RequireAsync(ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "clergy-title-assign:v1:" + accountId);
        if (await records.ReplayAsync<CommandResult>(Scope, op, ct) is not null)
            return await AssignmentAsync(accountId, ct);
        await PlatformDirectoryService.ReadAccountAsync(records, accountId, ct);
        string? titleId = null;
        if (request.ClergyTitleId is { } wanted)
        {
            var title = await ReadRowAsync(Guard.Id(wanted), ct);
            if (title.Value.Retired)
                throw new DomainException("clergy_title_retired", "A retired clergy title cannot be assigned.", FailureKind.Conflict);
            titleId = title.Value.Id;
        }
        var previous = await records.ReadAsync<ClergyTitleAssignment>(Scope, AssignmentKey(accountId), ct);
        if (previous is null && request.Version is not null || previous is not null && previous.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The clergy title assignment changed; reload it before saving.", FailureKind.Conflict);
        var value = new ClergyTitleAssignment { AccountId = accountId, ClergyTitleId = titleId, AssignedAt = op.At, AssignedBy = actor.AccountId };
        await records.CommitAsync(Scope, op, titleId is null ? "clergy_title.cleared" : "clergy_title.assigned", accountId,
            [previous is null ? RecordChange.Create(AssignmentKey(accountId), "clergyTitleAssignment", value)
                : RecordChange.Replace(AssignmentKey(accountId), "clergyTitleAssignment", value, previous.Version)],
            new CommandResult { Id = accountId, Status = titleId is null ? "Cleared" : "Assigned" }, ct);
        return await AssignmentAsync(accountId, ct);
    }

    private async Task RequireAsync(CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await platform.RequireOperatorAsync(ct);
    }

    // Either language satisfies the one-name rule; each is trimmed and kept as typed, never copied into the other.
    private static (string Title, string? TitleAr) Names(ClergyTitleSaveDto request)
    {
        var title = string.IsNullOrWhiteSpace(request.Title) ? string.Empty : Guard.Text(request.Title, "Title", 120);
        var titleAr = string.IsNullOrWhiteSpace(request.TitleAr) ? null : Guard.Text(request.TitleAr, "Arabic title", 120);
        return title.Length == 0 && titleAr is null ? throw new DomainException("invalid_input", "Type the title in English or Arabic.") : (title, titleAr);
    }

    private async Task<List<Versioned<ClergyTitle>>> AllAsync(CancellationToken ct)
    {
        var rows = new List<Versioned<ClergyTitle>>();
        string? cursor = null;
        do
        {
            var page = await records.PageAsync<ClergyTitle>(Scope, "clergyTitle", 100, cursor, ct);
            rows.AddRange(page.Items);
            cursor = page.ContinuationToken;
            if (rows.Count > Maximum)
                throw new DomainException("query_bound_exceeded", "The clergy title list is larger than this bounded read allows.", FailureKind.Unavailable);
        }
        while (cursor is not null);
        return rows;
    }

    private async Task<Versioned<ClergyTitle>> ReadRowAsync(string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<ClergyTitle>(Scope, TitleKey(id), ct);
        return row is not null && row.Value.Id == id ? row
            : throw new DomainException("resource_not_found", "The requested clergy title is unavailable.", FailureKind.NotFound);
    }

    private async Task<Versioned<ClergyTitleDto>> ReadAsync(string id, CancellationToken ct)
    {
        var row = await ReadRowAsync(id, ct);
        return new Versioned<ClergyTitleDto> { Value = Project(row.Value), Version = row.Version };
    }

    private static ClergyTitleDto Project(ClergyTitle value) => new()
    {
        Id = value.Id, Title = value.Title, TitleAr = value.TitleAr, Retired = value.Retired,
        CreatedAt = value.CreatedAt, UpdatedAt = value.UpdatedAt, UpdatedBy = value.UpdatedBy
    };
}
