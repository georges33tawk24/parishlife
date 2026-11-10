// Purpose: keeps priests' private pastoral notes and tasks, protected at rest and readable only by the author or explicitly chosen priests.
// Main functions: SaveAsync, ActAsync, GetAsync and ListAsync; helpers check current priest office, audience and task assignment rules.
// There is no administrator, bishop or successor fallback: only the author's explicit share widens the audience.

using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Care;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Care;

public class PastoralNoteService(IRecordTransactions records, IClergyAuthority clergy, ICurrentActor actor, MfaAccountAccess proof,
    IDataProtectionProvider protection, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "pastoralNote:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested note is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_note_state", message, FailureKind.Conflict);
    private IDataProtector Protector(string parish, string id) => protection.CreateProtector("ParishLife.PastoralNotes.v1", parish, id);

    private async Task<bool> IsPriestAsync(string parish, string account, CancellationToken ct)
    {
        try { await clergy.RequireAsync(parish, account, "Priest", ct); return true; }
        catch (DomainException) { return false; }
    }

    public async Task<PastoralNoteDto> SaveAsync(string parish, string? id, SavePastoralNoteDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        if (!await IsPriestAsync(parish, actor.AccountId, ct))
            throw Missing();
        var op = actor.CreateOperation(request.OperationId, request, clock, "pastoral-note:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project(parish, (await ReadAsync(parish, prior.Id, ct)).Value);
        Versioned<PastoralNote>? old = null;
        if (id is not null)
        {
            old = await ReadAsync(parish, id, ct);
            if (old.Value.AccountId != actor.AccountId)
                throw Missing();
        }
        var item = old?.Value ?? new PastoralNote { Id = op.Id, ParishId = parish, AccountId = actor.AccountId, Kind = request.Kind, CreatedAt = op.At,
            Status = request.Kind == "Task" ? "Open" : "Active" };
        if (old is not null && old.Value.Kind != request.Kind)
            throw State("A note cannot change between note and task.");
        item.Visibility = request.Visibility;
        item.SharedWithAccountId = null;
        if (request.Visibility == "NamedPriest")
        {
            var shared = Guard.Id(request.SharedWithAccountId ?? throw new DomainException("invalid_input", "Choose the priest to share with."));
            if (shared == actor.AccountId || !await IsPriestAsync(parish, shared, ct))
                throw new DomainException("invalid_input", "Share only with another current priest of this parish.");
            item.SharedWithAccountId = shared;
        }
        item.AssigneeAccountId = null;
        if (request.AssigneeAccountId is { } assignee)
        {
            // A task is never assigned to someone who cannot read it; assignment never widens the audience.
            var target = Guard.Id(assignee);
            var readable = target == actor.AccountId || item.Visibility == "NamedPriest" && target == item.SharedWithAccountId
                || item.Visibility == "ParishPriests" && await IsPriestAsync(parish, target, ct);
            if (request.Kind != "Task" || !readable)
                throw new DomainException("invalid_input", "Assign a task only to the author or a priest who can read it.");
            item.AssigneeAccountId = target;
        }
        if (request.PersonId is { } person)
        {
            var row = (await records.ReadAsync<Person>(Scope(parish), "person:" + Guard.Id(person), ct))?.Value;
            if (row is null || row.ParishId != parish)
                throw Missing();
            item.PersonId = row.Id;
        }
        else
            item.PersonId = null;
        item.Category = string.IsNullOrWhiteSpace(request.Category) ? null : Guard.Text(request.Category, "Category", 100);
        item.Priority = request.Kind == "Task" ? request.Priority : null;
        item.DueAt = request.Kind == "Task" && request.DueAt is { } due ? Guard.Utc(due) : null;
        var content = new PastoralNoteContent { Title = Guard.Text(request.Title, "Title", 300), Body = request.Body?.Length > 20000 ? throw new DomainException("invalid_input", "The body is too long.") : request.Body ?? "" };
        item.ProtectedContent = Protector(parish, item.Id).Protect(JsonSerializer.Serialize(content));
        item.UpdatedAt = op.At;
        // The receipt carries only the id and status; protected content never reaches receipts or audit.
        await records.CommitAsync(Scope(parish), op, "care.note_save", item.Id,
            [old is null ? RecordChange.Create(Key(item.Id), "pastoralNote", item) : RecordChange.Replace(Key(item.Id), "pastoralNote", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(parish, item);
    }

    public async Task<PastoralNoteDto> ActAsync(string parish, string id, PastoralNoteActionDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        var author = item.AccountId == actor.AccountId;
        var assignee = item.AssigneeAccountId == actor.AccountId && await CanReadAsync(parish, item, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "pastoral-note-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(parish, (await ReadAsync(parish, id, ct)).Value);
        switch (request.Action)
        {
            case "archive" when author && item.Status != "Archived":
                item.Status = "Archived";
                break;
            case "restore" when author && item.Status == "Archived":
                item.Status = item.Kind == "Task" ? (item.CompletedAt is null ? "Open" : "Done") : "Active";
                break;
            case "complete" when (author || assignee) && item.Kind == "Task" && item.Status == "Open":
                item.Status = "Done";
                item.CompletedAt = op.At;
                item.CompletedBy = actor.AccountId;
                break;
            case "reopen" when (author || assignee) && item.Kind == "Task" && item.Status == "Done":
                item.Status = "Open";
                item.CompletedAt = null;
                item.CompletedBy = null;
                break;
            default:
                if (!author && !assignee)
                    throw Missing();
                throw State("This action is not available for this note now.");
        }
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "care.note_" + request.Action, id,
            [RecordChange.Replace(Key(id), "pastoralNote", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(parish, item);
    }

    public async Task<Versioned<PastoralNoteDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var row = await ReadAsync(parish, id, ct);
        if (!await CanReadAsync(parish, row.Value, ct))
            throw Missing();
        return new Versioned<PastoralNoteDto> { Version = row.Version, Value = Project(parish, row.Value) };
    }

    // ponytail: filters at most 2000 notes per parish in memory; index the share recipient if notebooks grow beyond that.
    public async Task<IReadOnlyList<Versioned<PastoralNoteDto>>> ListAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var rows = await records.CollectAsync<PastoralNote>(Scope(parish), "pastoralNote", ct, 2000);
        var priest = await IsPriestAsync(parish, actor.AccountId, ct);
        return rows.Where(r => r.Value.AccountId == actor.AccountId
                || priest && (r.Value.Visibility == "ParishPriests" || r.Value.Visibility == "NamedPriest" && r.Value.SharedWithAccountId == actor.AccountId))
            .OrderByDescending(r => r.Value.UpdatedAt)
            .Select(r => new Versioned<PastoralNoteDto> { Version = r.Version, Value = Project(parish, r.Value) }).ToArray();
    }

    // Authors keep reading their own notes after leaving office; shared readers must be current priests of this parish.
    private async Task<bool> CanReadAsync(string parish, PastoralNote item, CancellationToken ct)
        => item.AccountId == actor.AccountId
            || item.Visibility == "ParishPriests" && await IsPriestAsync(parish, actor.AccountId, ct)
            || item.Visibility == "NamedPriest" && item.SharedWithAccountId == actor.AccountId && await IsPriestAsync(parish, actor.AccountId, ct);

    private async Task<Versioned<PastoralNote>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<PastoralNote>(Scope(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private PastoralNoteDto Project(string parish, PastoralNote x)
    {
        var content = JsonSerializer.Deserialize<PastoralNoteContent>(Protector(parish, x.Id).Unprotect(x.ProtectedContent)) ?? new PastoralNoteContent();
        return new PastoralNoteDto
        {
            Id = x.Id, Kind = x.Kind, Title = content.Title, Body = content.Body, Category = x.Category, PersonId = x.PersonId, Visibility = x.Visibility,
            SharedWithAccountId = x.SharedWithAccountId, AuthorAccountId = x.AccountId, Status = x.Status, AssigneeAccountId = x.AssigneeAccountId,
            Priority = x.Priority, DueAt = x.DueAt, CompletedAt = x.CompletedAt, CompletedBy = x.CompletedBy, CreatedAt = x.CreatedAt, UpdatedAt = x.UpdatedAt
        };
    }
}
