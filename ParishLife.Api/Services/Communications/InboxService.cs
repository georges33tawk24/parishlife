// Purpose: runs inbox conversations: members with the parish office, and office staff directly with linked parishioners.
// Main functions: StartAsync, ListAsync, MessagesAsync, PostAsync and ArchiveAsync; helpers check participation or office capacity,
// keep per-participant read/archive state and notify recipients in-app. There is no searchable person directory, and sent messages are final.

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Communications;

public class InboxService(IRecordTransactions records, IParishAccess access, MinistryAccess own, NotificationService notifications,
    ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "conversation:" + id;
    private static string MemberKey(string conversation, string account) => "conversationMember:" + conversation + ":" + account;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested conversation is unavailable.", FailureKind.NotFound);

    private async Task<bool> IsOfficeAsync(string parish, CancellationToken ct)
    {
        try
        {
            await proof.RequireMfaAsync(ct);
            await access.RequireAsync(parish, Permissions.CommunicationsManage, ct);
            return true;
        }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { return false; }
    }

    public async Task<ConversationDto> StartAsync(string parish, StartConversationDto request, CancellationToken ct)
    {
        string[] participants;
        string kind;
        if (request.RecipientAccountId is null)
        {
            // Members write to the parish office; they never pick arbitrary people from a directory.
            await own.PersonalAsync(ct);
            await own.RootAsync(parish, ct);
            participants = [actor.AccountId];
            kind = "Office";
        }
        else
        {
            if (!await IsOfficeAsync(parish, ct))
                throw Missing();
            var recipient = Guard.Id(request.RecipientAccountId.Value);
            var link = await records.ReadAsync<PersonAccountLink>(Scope(parish), "personAccountLink:" + recipient, ct);
            if (link?.Value.Active != true || link.Value.ParishId != parish || recipient == actor.AccountId)
                throw new DomainException("invalid_input", "Direct conversations are with a linked parishioner of this parish.");
            participants = [actor.AccountId, recipient];
            kind = "Direct";
        }
        var op = actor.CreateOperation(request.OperationId, request, clock, "conversation:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await ProjectAsync(parish, (await ReadAsync(parish, prior.Id, ct)).Value, ct);
        var item = new Conversation
        {
            Id = op.Id, ParishId = parish, Kind = kind, Subject = Guard.Text(request.Subject, "Subject", 300), ParticipantAccountIds = participants,
            CreatedBy = actor.AccountId, CreatedAt = op.At, LastMessageAt = op.At
        };
        var message = new InboxMessage { Id = op.Id, ConversationId = item.Id, AuthorAccountId = actor.AccountId, Capacity = kind == "Direct" ? "Office" : "Self",
            Body = Guard.Text(request.Body, "Message", 10000), At = op.At };
        var changes = new List<RecordChange> { RecordChange.Create(Key(item.Id), "conversation", item), RecordChange.Create("inboxMessage:" + message.Id, "inboxMessage", message) };
        changes.AddRange(participants.Select(p => RecordChange.Create(MemberKey(item.Id, p), "conversationMember",
            new ConversationMember { ConversationId = item.Id, AccountId = p, LastReadAt = p == actor.AccountId ? op.At : null })));
        await records.CommitAsync(Scope(parish), op, "inbox.start", item.Id, changes, new CommandResult { Id = item.Id, Status = "Started" }, ct);
        await NotifyAsync(parish, item, message, ct);
        return await ProjectAsync(parish, item, ct);
    }

    public async Task<IReadOnlyList<ConversationDto>> ListAsync(string parish, CancellationToken ct)
    {
        var office = await IsOfficeAsync(parish, ct);
        var ids = (await records.CollectAsync<ConversationMember>(Scope(parish), "conversationMember", ct, 2000, Equal("accountId", actor.AccountId)))
            .Select(m => m.Value.ConversationId).ToHashSet(StringComparer.Ordinal);
        var result = new List<ConversationDto>();
        foreach (var id in ids)
            if (await records.ReadAsync<Conversation>(Scope(parish), Key(id), ct) is { } row)
                result.Add(await ProjectAsync(parish, row.Value, ct));
        // The shared office inbox is visible to authorized office staff, each acting under their own account.
        if (office)
            foreach (var row in await records.CollectAsync<Conversation>(Scope(parish), "conversation", ct, 2000, Equal("kind", "Office")))
                if (!ids.Contains(row.Value.Id))
                    result.Add(await ProjectAsync(parish, row.Value, ct));
        return result.OrderByDescending(c => c.LastMessageAt).ToArray();
    }

    public async Task<IReadOnlyList<InboxMessageDto>> MessagesAsync(string parish, string id, CancellationToken ct)
    {
        var item = await AccessibleAsync(parish, id, ct);
        var messages = await records.CollectAsync<InboxMessage>(Scope(parish), "inboxMessage", ct, 2000, Equal("conversationId", id));
        await SetMemberAsync(parish, item.Id, m => m.LastReadAt = clock.GetUtcNow(), ct);
        return messages.Select(m => m.Value).OrderBy(m => m.At).ThenBy(m => m.Id, StringComparer.Ordinal)
            .Select(m => new InboxMessageDto { Id = m.Id, AuthorAccountId = m.AuthorAccountId, Capacity = m.Capacity, Body = m.Body, At = m.At }).ToArray();
    }

    public async Task<InboxMessageDto> PostAsync(string parish, string id, PostInboxMessageDto request, CancellationToken ct)
    {
        var row = await records.ReadAsync<Conversation>(Scope(parish), Key(id), ct) ?? throw Missing();
        var item = await AccessibleAsync(parish, id, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "inbox-message:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await records.ReadAsync<InboxMessage>(Scope(parish), "inboxMessage:" + prior.Id, ct))!.Value);
        // Staff replying in a member's office conversation write for the parish office, attributed to their own account.
        var capacity = item.Kind == "Office" && !item.ParticipantAccountIds.Contains(actor.AccountId) || item.Kind == "Direct" && item.CreatedBy == actor.AccountId ? "Office" : "Self";
        var message = new InboxMessage { Id = op.Id, ConversationId = id, AuthorAccountId = actor.AccountId, Capacity = capacity, Body = Guard.Text(request.Body, "Message", 10000), At = op.At };
        item.LastMessageAt = op.At;
        await records.CommitAsync(Scope(parish), op, "inbox.message", id,
            [RecordChange.Create("inboxMessage:" + message.Id, "inboxMessage", message), RecordChange.Replace(Key(id), "conversation", item, row.Version)],
            new CommandResult { Id = message.Id, Status = "Sent" }, ct);
        await NotifyAsync(parish, item, message, ct);
        return Project(message);
    }

    public async Task<ConversationDto> ArchiveAsync(string parish, string id, bool archived, CancellationToken ct)
    {
        var item = await AccessibleAsync(parish, id, ct);
        // Archiving changes only the caller's own view; the other participants keep the conversation.
        await SetMemberAsync(parish, id, m => m.Archived = archived, ct);
        return await ProjectAsync(parish, item, ct);
    }

    private async Task<Conversation> AccessibleAsync(string parish, string id, CancellationToken ct)
    {
        var item = (await records.ReadAsync<Conversation>(Scope(parish), Key(id), ct) ?? throw Missing()).Value;
        if (item.ParishId != parish)
            throw Missing();
        if (item.ParticipantAccountIds.Contains(actor.AccountId))
        {
            if (item.Kind == "Direct" && item.CreatedBy == actor.AccountId && !await IsOfficeAsync(parish, ct))
                throw Missing();
            return item;
        }
        if (item.Kind == "Office" && await IsOfficeAsync(parish, ct))
            return item;
        throw Missing();
    }

    private async Task SetMemberAsync(string parish, string conversation, Action<ConversationMember> change, CancellationToken ct)
    {
        var key = MemberKey(conversation, actor.AccountId);
        var row = await records.ReadAsync<ConversationMember>(Scope(parish), key, ct);
        var value = row?.Value ?? new ConversationMember { ConversationId = conversation, AccountId = actor.AccountId };
        change(value);
        try
        {
            await records.CommitAsync(Scope(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { conversation }, clock), "inbox.state", conversation,
                [row is null ? RecordChange.Create(key, "conversationMember", value) : RecordChange.Replace(key, "conversationMember", value, row.Version)],
                new CommandResult { Id = conversation, Status = "Updated" }, ct);
        }
        catch (DomainException error) when (error.Code == "write_conflict") { }
    }

    private async Task NotifyAsync(string parish, Conversation item, InboxMessage message, CancellationToken ct)
    {
        foreach (var recipient in item.ParticipantAccountIds.Where(p => p != message.AuthorAccountId))
            await notifications.NotifyAsync(recipient, parish, "inbox.message", "You have a new message from your parish.",
                "/api/parishes/" + parish + "/inbox/" + item.Id, required: true, "inbox:" + message.Id, ct);
    }

    private async Task<Versioned<Conversation>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<Conversation>(Scope(parish), Key(id), ct) ?? throw Missing();

    private async Task<ConversationDto> ProjectAsync(string parish, Conversation x, CancellationToken ct)
    {
        var member = (await records.ReadAsync<ConversationMember>(Scope(parish), MemberKey(x.Id, actor.AccountId), ct))?.Value;
        return new ConversationDto
        {
            Id = x.Id, Kind = x.Kind, Subject = x.Subject, ParticipantAccountIds = [.. x.ParticipantAccountIds], LastMessageAt = x.LastMessageAt,
            Unread = member?.LastReadAt is not { } read || read < x.LastMessageAt, Archived = member?.Archived == true
        };
    }

    private static InboxMessageDto Project(InboxMessage m) => new() { Id = m.Id, AuthorAccountId = m.AuthorAccountId, Capacity = m.Capacity, Body = m.Body, At = m.At };
}
