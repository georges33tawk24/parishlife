// Purpose: owns account-private notes/tasks, protected content/history, current personal authorization and atomic conditional writes.
// Main functions: SaveAsync, ActAsync, GetAsync, ListAsync and HistoryAsync; private command records validate retries without text in audit/receipts.
// Pin, reminder date and linked meeting stay inside the protected content; a newly linked meeting must be one the account can currently read.

using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.PersonalWorkspace;

public class PersonalWorkspaceService(IRecordTransactions records, MfaAccountAccess proof, UserManager<ParishUser> users,
    ICurrentActor actor, IDataProtectionProvider protection, TimeProvider clock, MinistryMeetingService meetings)
{
    private static readonly HashSet<string> TaskStatuses = new(StringComparer.Ordinal)
        { "Draft", "Open", "InProgress", "Waiting", "Completed", "Cancelled", "Archived" };
    private static readonly HashSet<string> Actions = new(StringComparer.Ordinal)
        { "start", "wait", "complete", "reopen", "cancel", "archive", "restore" };

    public async Task<Versioned<PersonalItemDto>> SaveAsync(string? itemId, SavePersonalItemDto request, CancellationToken ct)
    {
        var account = await PersonalAsync(ct);
        var id = itemId is null ? Guard.Id(request.OperationId) : Id(itemId);
        var action = itemId is null ? "create" : "edit";
        var operation = Command(request.OperationId, id, action);
        var input = JsonSerializer.Serialize(request);
        if (await ReplayAsync(account.Id, id, action, operation, input, ct))
            return await GetAsync(id, ct);
        if (request.Kind is not ("Note" or "Task"))
            throw Invalid("Choose a personal Note or Task.");
        if (itemId is null && request.Version is not null)
            throw Invalid("A new personal item has no previous version.");
        var content = Content(request);
        var previous = itemId is null ? null : await ReadAsync(account.Id, id, ct);
        var priorContent = previous is null ? null : ReadContent(previous.Value);
        if (content.MeetingId is not null && (priorContent?.MeetingId != content.MeetingId
            || priorContent.MeetingMinistryId != content.MeetingMinistryId || priorContent.MeetingParishId != content.MeetingParishId))
            await RequireReadableMeetingAsync(content, ct);
        if (previous is not null && (previous.Value.Kind != request.Kind
            || previous.Value.Status is "Completed" or "Cancelled" or "Archived"
            || request.SaveAsDraft && previous.Value.Status != "Draft"))
            throw State("Restore or reopen this item before editing; its original note/task kind cannot change.");
        var value = previous?.Value ?? new PersonalWorkspaceItem
        { Id = id, AccountId = account.Id, Kind = request.Kind, CreatedAt = operation.At };
        var priorRevision = previous?.Value.RevisionId;
        var priorStatus = previous?.Value.Status;
        if (previous is null || value.Status == "Draft")
            value.Status = request.SaveAsDraft ? "Draft" : value.Kind == "Note" ? "Saved" : "Open";
        value.RevisionId = operation.Id;
        value.UpdatedAt = operation.At;
        value.ProtectedContent = ContentProtector(account.Id, id, operation.Id).Protect(JsonSerializer.Serialize(content));
        var itemChange = previous is null ? RecordChange.Create(Key(id), "personalWorkspaceItem", value)
            : RecordChange.Replace(Key(id), "personalWorkspaceItem", value, Versions.Require(request.Version));
        await CommitAsync(account, value, action, priorRevision, priorStatus, operation, input, itemChange, ct);
        return await GetAsync(id, ct);
    }

    public async Task<Versioned<PersonalItemDto>> ActAsync(string itemId, PersonalItemActionDto request, CancellationToken ct)
    {
        var account = await PersonalAsync(ct);
        var id = Id(itemId);
        if (!Actions.Contains(request.Action))
            throw Invalid("Choose start, wait, complete, reopen, cancel, archive or restore.");
        var operation = Command(request.OperationId, id, request.Action);
        var input = JsonSerializer.Serialize(request);
        if (await ReplayAsync(account.Id, id, request.Action, operation, input, ct))
            return await GetAsync(id, ct);
        var row = await ReadAsync(account.Id, id, ct);
        var value = row.Value;
        var content = ReadContent(value);
        var priorRevision = value.RevisionId;
        var priorStatus = value.Status;
        if (request.Action == "archive")
        {
            if (value.Status == "Archived")
                throw State("This item is already archived.");
            value.StatusBeforeArchive = value.Status;
            value.Status = "Archived";
            value.ArchivedAt = operation.At;
        }
        else if (request.Action == "restore")
        {
            if (value.Status != "Archived" || value.StatusBeforeArchive is null)
                throw State("Restore only an archived item.");
            value.Status = value.StatusBeforeArchive;
            value.StatusBeforeArchive = null;
            value.ArchivedAt = null;
        }
        else
        {
            if (value.Kind != "Task")
                throw State("Notes can be archived; only personal tasks have progress or completion.");
            value.Status = request.Action switch
            {
                "start" when value.Status is "Open" or "Waiting" => "InProgress",
                "wait" when value.Status is "Open" or "InProgress" => "Waiting",
                "complete" when value.Status is "Open" or "InProgress" or "Waiting" => "Completed",
                "reopen" when value.Status is "Completed" or "Cancelled" => "Open",
                "cancel" when value.Status is "Open" or "InProgress" or "Waiting" => "Cancelled",
                _ => throw State("This action does not apply to the item's current state.")
            };
            if (request.Action == "complete")
                value.CompletedAt = value.LastCompletedAt = operation.At;
            if (request.Action == "reopen")
                value.CompletedAt = null;
        }
        value.UpdatedAt = operation.At;
        value.RevisionId = operation.Id;
        value.ProtectedContent = ContentProtector(account.Id, id, operation.Id).Protect(JsonSerializer.Serialize(content));
        await CommitAsync(account, value, request.Action, priorRevision, priorStatus, operation, input,
            RecordChange.Replace(Key(id), "personalWorkspaceItem", value, Versions.Require(request.Version)), ct);
        return await GetAsync(id, ct);
    }

    public async Task<Versioned<PersonalItemDto>> GetAsync(string itemId, CancellationToken ct)
    {
        var account = await PersonalAsync(ct);
        var row = await ReadAsync(account.Id, Id(itemId), ct);
        return new() { Value = View(row.Value), Version = row.Version };
    }

    public async Task<Page<Versioned<PersonalItemDto>>> ListAsync(int size, string? cursor, string? kind, string? status, CancellationToken ct)
    {
        var account = await PersonalAsync(ct);
        var filters = new List<RecordCondition>();
        if (kind is not null)
        {
            if (kind is not ("Note" or "Task"))
                throw Invalid("Filter by Note or Task.");
            filters.Add(Equal("kind", kind));
        }
        if (status is not null)
        {
            if (status != "Saved" && !TaskStatuses.Contains(status))
                throw Invalid("Use an actual personal item status.");
            filters.Add(Equal("status", status));
        }
        var page = await records.PageAsync<PersonalWorkspaceItem>(Scope(account.Id), "personalWorkspaceItem", size, cursor, ct, filters.ToArray());
        foreach (var row in page.Items)
            ValidateItem(account.Id, row.Value.Id, row.Value);
        return new()
        {
            Items = page.Items.Select(row => new Versioned<PersonalItemDto> { Value = View(row.Value), Version = row.Version }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<Page<PersonalItemRevisionDto>> HistoryAsync(string itemId, int size, string? cursor, CancellationToken ct)
    {
        var account = await PersonalAsync(ct);
        var id = Id(itemId);
        await ReadAsync(account.Id, id, ct);
        var page = await records.PageAsync<PersonalWorkspaceRevision>(Scope(account.Id), "personalWorkspaceRevision", size, cursor, ct, Equal("itemId", id));
        var items = new List<PersonalItemRevisionDto>();
        foreach (var row in page.Items)
        {
            var value = row.Value;
            if (value.AccountId != account.Id || value.ItemId != id || value.ActorId != account.Id || value.Id != value.Snapshot.RevisionId)
                throw Missing();
            ValidateItem(account.Id, id, value.Snapshot);
            items.Add(new()
            {
                Id = value.Id,
                Action = value.Action,
                PreviousRevisionId = value.PreviousRevisionId,
                PreviousStatus = value.PreviousStatus,
                ActorId = value.ActorId,
                RecordedAt = value.RecordedAt,
                Snapshot = View(value.Snapshot)
            });
        }
        return new() { Items = items, ContinuationToken = page.ContinuationToken };
    }

    private async Task<ParishUser> PersonalAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || proof.RecoverySession)
            throw new DomainException("personal_workspace_capacity_required", "Use your normal personal sign-in for My notes and personal tasks.", FailureKind.Forbidden);
        var account = await proof.CurrentAsync(ct);
        if (await users.IsLockedOutAsync(account))
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        return account;
    }

    private async Task<Versioned<PersonalWorkspaceItem>> ReadAsync(string account, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<PersonalWorkspaceItem>(Scope(account), Key(id), ct) ?? throw Missing();
        ValidateItem(account, id, row.Value);
        return row;
    }

    private async Task CommitAsync(ParishUser account, PersonalWorkspaceItem value, string action, string? priorRevision,
        string? priorStatus, Operation operation, string input, RecordChange itemChange, CancellationToken ct)
    {
        var revision = new PersonalWorkspaceRevision
        {
            Id = operation.Id,
            AccountId = account.Id,
            ItemId = value.Id,
            Action = action,
            PreviousRevisionId = priorRevision,
            PreviousStatus = priorStatus,
            ActorId = actor.AccountId,
            RecordedAt = operation.At,
            Snapshot = value
        };
        var command = new PersonalWorkspaceCommand
        {
            Id = operation.Id,
            AccountId = account.Id,
            ItemId = value.Id,
            Action = action,
            ProtectedRequest = CommandProtector(account.Id, operation.Id).Protect(input)
        };
        await records.CommitAsync(Scope(account.Id), operation, "personal.workspace_changed", value.Id,
            [RecordChange.Replace("account", "account", account, account.PersistenceVersion!), itemChange,
             RecordChange.Create("personalWorkspaceRevision:" + operation.Id, "personalWorkspaceRevision", revision),
             RecordChange.Create("personalWorkspaceCommand:" + operation.Id, "personalWorkspaceCommand", command)],
            new CommandResult { Id = value.Id, Status = "Recorded" }, ct);
        // A concurrent duplicate can return the winner's receipt; compare its protected private input before acknowledging it.
        await RequireCommandAsync(account.Id, value.Id, action, operation.Id, input, ct);
    }

    private async Task<bool> ReplayAsync(string account, string id, string action, Operation operation, string input, CancellationToken ct)
    {
        if (await records.ReplayAsync<CommandResult>(Scope(account), operation, ct) is null)
            return false;
        await RequireCommandAsync(account, id, action, operation.Id, input, ct);
        return true;
    }

    private async Task RequireCommandAsync(string account, string id, string action, string operationId, string input, CancellationToken ct)
    {
        var row = await records.ReadAsync<PersonalWorkspaceCommand>(Scope(account), "personalWorkspaceCommand:" + operationId, ct);
        if (row is null || row.Value.Id != operationId || row.Value.AccountId != account || row.Value.ItemId != id || row.Value.Action != action)
            throw State("The private command record requires review before this operation can be acknowledged.");
        string previous;
        try
        { previous = CommandProtector(account, operationId).Unprotect(row.Value.ProtectedRequest); }
        catch (CryptographicException) { throw ProtectedUnavailable(); }
        if (!string.Equals(previous, input, StringComparison.Ordinal))
            throw new DomainException("idempotency_conflict", "This operation was already used with different input; use a new operation for a new change.", FailureKind.Conflict);
    }

    private Operation Command(Guid operationId, string id, string action) => Operation.Create(operationId, actor.AccountId,
        new { Kind = "personal.workspace", ItemId = id, Action = action }, clock, "personal-workspace:v1");

    private static PersonalWorkspaceContent Content(SavePersonalItemDto request)
    {
        if (request.Body is null || request.Body.Length > 20000 || !request.SaveAsDraft && string.IsNullOrWhiteSpace(request.Body))
            throw Invalid("A saved personal item needs body text of at most 20000 characters; an unfinished draft may be empty.");
        if (request.Tags is null || request.Tags.Length > 20)
            throw Invalid("Use at most 20 private tags.");
        var tags = request.Tags.Select(tag => Guard.Text(tag, "Private tag", 60)).ToArray();
        if (tags.Distinct(StringComparer.Ordinal).Count() != tags.Length)
            throw Invalid("Private tags must be distinct.");
        var priority = Optional(request.Priority, "Priority", 20);
        var reason = Optional(request.PriorityReason, "Priority reason", 2000);
        if (request.Kind == "Note" && (priority is not null || reason is not null || request.DueAt is not null))
            throw Invalid("Due dates and priorities belong to tasks; a note has no completion state.");
        if (priority is not null && priority is not ("Routine" or "TimeSensitive" or "High") || priority == "High" && reason is null
            || reason is not null && priority != "High")
            throw Invalid("Choose Routine, TimeSensitive or High; High requires its reason.");
        if (request.DueAt is { } due)
            Guard.Utc(due);
        if (request.ReminderAt is { } reminder && (reminder == default || reminder.Offset != TimeSpan.Zero))
            throw Invalid("A private reminder date must be an explicit UTC instant.");
        var linked = new[] { request.MeetingParishId, request.MeetingMinistryId, request.MeetingId };
        if (linked.Any(x => x is not null) && linked.Any(x => x is null || x == Guid.Empty))
            throw Invalid("Link a meeting with its parish, ministry and meeting identifiers together, or leave all three empty.");
        return new()
        {
            Title = Optional(request.Title, "Title", 500),
            Body = request.Body,
            Category = Optional(request.Category, "Category", 100),
            Tags = tags,
            Priority = priority,
            PriorityReason = reason,
            DueAt = request.DueAt,
            Pinned = request.Pinned,
            ReminderAt = request.ReminderAt,
            MeetingParishId = request.MeetingParishId?.ToString("N"),
            MeetingMinistryId = request.MeetingMinistryId?.ToString("N"),
            MeetingId = request.MeetingId?.ToString("N")
        };
    }

    // A new or changed link must name a meeting the account can read now; an unchanged link survives a later departure.
    private async Task RequireReadableMeetingAsync(PersonalWorkspaceContent content, CancellationToken ct)
    {
        try
        { await meetings.GetAsync(content.MeetingParishId!, content.MeetingMinistryId!, content.MeetingId!, ct); }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden or FailureKind.Conflict)
        { throw Invalid("Link a meeting you can currently see."); }
    }

    private PersonalWorkspaceContent ReadContent(PersonalWorkspaceItem value)
    {
        try
        {
            return JsonSerializer.Deserialize<PersonalWorkspaceContent>(ContentProtector(value.AccountId, value.Id, value.RevisionId).Unprotect(value.ProtectedContent))
                ?? throw ProtectedUnavailable();
        }
        catch (Exception error) when (error is CryptographicException or JsonException) { throw ProtectedUnavailable(); }
    }

    private PersonalItemDto View(PersonalWorkspaceItem value)
    {
        var content = ReadContent(value);
        return new()
        {
            Id = value.Id,
            OwnerAccountId = value.AccountId,
            Kind = value.Kind,
            Status = value.Status,
            RevisionId = value.RevisionId,
            Title = content.Title,
            Body = content.Body,
            Category = content.Category,
            Tags = content.Tags,
            Priority = content.Priority,
            PriorityReason = content.PriorityReason,
            DueAt = content.DueAt,
            Pinned = content.Pinned,
            ReminderAt = content.ReminderAt,
            MeetingParishId = content.MeetingParishId,
            MeetingMinistryId = content.MeetingMinistryId,
            MeetingId = content.MeetingId,
            CreatedAt = value.CreatedAt,
            UpdatedAt = value.UpdatedAt,
            CompletedAt = value.CompletedAt,
            LastCompletedAt = value.LastCompletedAt,
            ArchivedAt = value.ArchivedAt
        };
    }

    private static void ValidateItem(string account, string id, PersonalWorkspaceItem value)
    {
        var validState = value.Kind == "Note" ? value.Status is "Draft" or "Saved" or "Archived" : value.Kind == "Task" && TaskStatuses.Contains(value.Status);
        if (value.AccountId != account || value.Id != id || !validState || string.IsNullOrWhiteSpace(value.RevisionId)
            || string.IsNullOrWhiteSpace(value.ProtectedContent))
            throw Missing();
    }
    private IDataProtector ContentProtector(string account, string id, string revision)
        => protection.CreateProtector("ParishLife.PersonalWorkspace.Content.v1", account, id, revision);
    private IDataProtector CommandProtector(string account, string operation)
        => protection.CreateProtector("ParishLife.PersonalWorkspace.Command.v1", account, operation);
    private static RecordScope Scope(string account) => new() { Area = RecordArea.Account, OwnerId = account };
    private static string Key(string id) => "personalWorkspaceItem:" + id;
    private static string Id(string id) => Guid.TryParse(id, out var value) && value != Guid.Empty && value.ToString("N") == id ? id : throw Missing();
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static string? Optional(string? text, string name, int maximum) => string.IsNullOrWhiteSpace(text) ? null : Guard.Text(text, name, maximum);
    private static DomainException Missing() => new("resource_not_found", "The requested personal item is unavailable.", FailureKind.NotFound);
    private static DomainException Invalid(string message) => new("invalid_personal_item", message);
    private static DomainException State(string message) => new("invalid_personal_item_state", message, FailureKind.Conflict);
    private static DomainException ProtectedUnavailable() => new("personal_content_unavailable", "The protected personal content could not be read.", FailureKind.Unavailable);
}
