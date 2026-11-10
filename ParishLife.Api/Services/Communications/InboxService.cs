// Purpose: runs inbox conversations: members with the parish office, and office staff directly with linked parishioners.
// Main functions: StartAsync, ListAsync, MessagesAsync, PostAsync, ArchiveAsync, NotificationOutcomeAsync, MessageNotificationOutcomeAsync and internal AccessibleAsync; helpers check participation or office capacity,
// keep per-participant read/archive state and stage required recipient notices with each message. There is no searchable person directory,
// and sent messages are final; notice dispatch happens independently after the source commit.

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
    ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock, NotificationOutcomeReader outcomes)
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
        {
            var previous = (await ReadAsync(parish, prior.Id, ct)).Value;
            var replay = await ProjectAsync(parish, previous, ct);
            replay.NotificationOutcome = await outcomes.ReadAsync(parish, previous.NotificationWorkIds, ct);
            return replay;
        }
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
        TrackNotices(parish, item, message, changes);
        await records.CommitAsync(Scope(parish), op, "inbox.start", item.Id, changes, new CommandResult { Id = item.Id, Status = "Started" }, ct);
        await DispatchNoticesAsync(parish, item, message, ct);
        var result = await ProjectAsync(parish, item, ct);
        result.NotificationOutcome = await outcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
        return result;
    }

    public async Task<IReadOnlyList<ConversationDto>> ListAsync(string parish, CancellationToken ct)
    {
        var office = await IsOfficeAsync(parish, ct);
        if (!office) await own.PersonalAsync(ct);
        var ids = (await records.CollectAsync<ConversationMember>(Scope(parish), "conversationMember", ct, 2000, Equal("accountId", actor.AccountId)))
            .Select(m => m.Value.ConversationId).ToHashSet(StringComparer.Ordinal);
        var result = new List<ConversationDto>();
        var listed = new HashSet<string>(StringComparer.Ordinal);
        foreach (var id in ids)
            if (await records.ReadAsync<Conversation>(Scope(parish), Key(id), ct) is { } row
                && row.Value.ParticipantAccountIds.Contains(actor.AccountId, StringComparer.Ordinal)
                && (row.Value.Kind != "Direct" || row.Value.CreatedBy != actor.AccountId || office))
            {
                listed.Add(id);
                result.Add(await ProjectAsync(parish, row.Value, ct));
            }
        // The shared office inbox is visible to authorized office staff, each acting under their own account. Staff who opened a
        // member's Office conversation have a read-state row without being a participant, so only already-listed rows are skipped.
        if (office)
            foreach (var row in await records.CollectAsync<Conversation>(Scope(parish), "conversation", ct, 2000, Equal("kind", "Office")))
                if (!listed.Contains(row.Value.Id))
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
            return await MessageViewAsync(parish, (await records.ReadAsync<InboxMessage>(Scope(parish), "inboxMessage:" + prior.Id, ct))!.Value, ct);
        // Staff replying in a member's office conversation write for the parish office, attributed to their own account.
        var capacity = item.Kind == "Office" && !item.ParticipantAccountIds.Contains(actor.AccountId) || item.Kind == "Direct" && item.CreatedBy == actor.AccountId ? "Office" : "Self";
        var message = new InboxMessage { Id = op.Id, ConversationId = id, AuthorAccountId = actor.AccountId, Capacity = capacity, Body = Guard.Text(request.Body, "Message", 10000), At = op.At };
        item.LastMessageAt = op.At;
        var changes = new List<RecordChange>
        {
            RecordChange.Create("inboxMessage:" + message.Id, "inboxMessage", message),
            RecordChange.Replace(Key(id), "conversation", item, row.Version)
        };
        TrackNotices(parish, item, message, changes);
        await records.CommitAsync(Scope(parish), op, "inbox.message", id,
            changes, new CommandResult { Id = message.Id, Status = "Sent" }, ct);
        await DispatchNoticesAsync(parish, item, message, ct);
        return await MessageViewAsync(parish, message, ct);
    }

    public async Task<ConversationDto> ArchiveAsync(string parish, string id, bool archived, CancellationToken ct)
    {
        var item = await AccessibleAsync(parish, id, ct);
        // Archiving changes only the caller's own view; the other participants keep the conversation.
        await SetMemberAsync(parish, id, m => m.Archived = archived, ct);
        return await ProjectAsync(parish, item, ct);
    }

    internal async Task<Conversation> AccessibleAsync(string parish, string id, CancellationToken ct)
    {
        var item = (await records.ReadAsync<Conversation>(Scope(parish), Key(id), ct) ?? throw Missing()).Value;
        if (item.ParishId != parish)
            throw Missing();
        if (item.ParticipantAccountIds.Contains(actor.AccountId))
        {
            if (item.Kind == "Direct" && item.CreatedBy == actor.AccountId)
            {
                if (!await IsOfficeAsync(parish, ct)) throw Missing();
            }
            else await own.PersonalAsync(ct);
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

    private IEnumerable<RecordChange> NoticeChanges(string parish, Conversation item, InboxMessage message)
        => item.ParticipantAccountIds.Where(p => p != message.AuthorAccountId).Distinct(StringComparer.Ordinal)
            .Select(recipient => notifications.StageRequired(parish, recipient, "inbox.message", "You have a new message from your parish.",
                "/api/parishes/" + parish + "/inbox/" + item.Id, "inbox:" + message.Id, "InboxParticipant", item.Id, message.At));

    private void TrackNotices(string parish, Conversation item, InboxMessage message, List<RecordChange> changes)
    {
        var notices = NoticeChanges(parish, item, message).ToArray();
        var ids = notices.Select(change => ((NotificationWork)change.Value!).Id).ToList();
        message.NotificationWorkIds = ids;
        item.NotificationWorkIds = [.. ids];
        changes.AddRange(notices);
    }

    public async Task<NotificationOutcomeDto> NotificationOutcomeAsync(string parish, string id, CancellationToken ct)
    {
        var item = await AccessibleAsync(parish, id, ct);
        return await outcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
    }

    public async Task<NotificationOutcomeDto> MessageNotificationOutcomeAsync(string parish, string conversation, string id, CancellationToken ct)
    {
        await AccessibleAsync(parish, conversation, ct);
        var row = await records.ReadAsync<InboxMessage>(Scope(parish), "inboxMessage:" + id, ct);
        if (row is null || row.Value.Id != id || row.Value.ConversationId != conversation) throw Missing();
        return await outcomes.ReadAsync(parish, row.Value.NotificationWorkIds, ct);
    }

    private async Task<InboxMessageDto> MessageViewAsync(string parish, InboxMessage item, CancellationToken ct)
    {
        var result = Project(item);
        result.NotificationOutcome = await outcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
        return result;
    }

    private async Task DispatchNoticesAsync(string parish, Conversation item, InboxMessage message, CancellationToken ct)
    {
        foreach (var recipient in item.ParticipantAccountIds.Where(p => p != message.AuthorAccountId).Distinct(StringComparer.Ordinal))
            await notifications.DispatchAsync(parish, recipient, "inbox:" + message.Id, ct);
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
