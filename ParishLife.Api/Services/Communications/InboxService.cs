// Purpose: runs inbox conversations: members with the parish office, and office staff directly with linked parishioners.
// Main functions: StartAsync (office, or direct by account or by a person the office may read; a chat with the same people is reused, one chat
// per person), ListAsync (also marks what this account's list showed: the delivered tick), MessagesAsync (marks read; the caller's own
// messages carry Delivered/Read), PostAsync, PostVoiceAsync and VoiceAsync (voice notes, audio checked by content and stored privately),
// ArchiveAsync, NotificationOutcomeAsync, MessageNotificationOutcomeAsync and internal AccessibleAsync; helpers check participation or office
// capacity, keep per-participant read/archive state, stage required recipient notices with each message and push a live event (LiveHub). There is no searchable person directory,
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
    ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock, NotificationOutcomeReader outcomes, IEvidenceStore store, LiveHub live)
{
    internal const long MaximumVoiceBytes = 5 * 1024 * 1024;
    internal const string VoiceBody = "Voice message";
    private static string Key(string id) => "conversation:" + id;
    private static string MemberKey(string conversation, string account) => "conversationMember:" + conversation + ":" + account;
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
        if (request.RecipientAccountId is not null && request.RecipientPersonId is not null)
            throw new DomainException("invalid_input", "Name the recipient by account or by person, not both.");
        if (request.RecipientAccountId is null && request.RecipientPersonId is null)
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
            var recipient = request.RecipientAccountId is { } account ? Guard.Id(account) : await PersonAccountAsync(parish, Guard.Id(request.RecipientPersonId!.Value), ct);
            var link = await records.ReadAsync<PersonAccountLink>(RecordScopes.Parish(parish), "personAccountLink:" + recipient, ct);
            if (link?.Value.Active != true || link.Value.ParishId != parish || recipient == actor.AccountId)
                throw new DomainException("invalid_input", "Direct conversations are with a linked parishioner of this parish.");
            participants = [actor.AccountId, recipient];
            kind = "Direct";
        }
        var op = actor.CreateOperation(request.OperationId, request, clock, "conversation:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(RecordScopes.Parish(parish), op, ct) is { } prior)
        {
            var previous = (await ReadAsync(parish, prior.Id, ct)).Value;
            var replay = await ProjectAsync(parish, previous, ct);
            replay.NotificationOutcome = await outcomes.ReadAsync(parish, previous.NotificationWorkIds, ct);
            return replay;
        }
        var body = Guard.Text(request.Body, "Message", 10000);
        // One chat per person: the same people already have a chat here, so the message joins it.
        if (await SameChatAsync(parish, kind, participants, ct) is { } same)
        {
            await AppendAsync(parish, same, op, new InboxMessage { Body = body }, "inbox.message", ct, resultId: same.Value.Id); // a replay reads the conversation
            var joined = await ProjectAsync(parish, (await ReadAsync(parish, same.Value.Id, ct)).Value, ct);
            joined.NotificationOutcome = await outcomes.ReadAsync(parish, same.Value.NotificationWorkIds, ct);
            return joined;
        }
        var subject = string.IsNullOrWhiteSpace(request.Subject) ? FirstLine(body) : Guard.Text(request.Subject, "Subject", 300);
        var item = new Conversation
        {
            Id = op.Id, ParishId = parish, Kind = kind, Subject = subject, ParticipantAccountIds = participants,
            CreatedBy = actor.AccountId, CreatedAt = op.At, LastMessageAt = op.At
        };
        var message = new InboxMessage { Id = op.Id, ConversationId = item.Id, AuthorAccountId = actor.AccountId, Capacity = kind == "Direct" ? "Office" : "Self",
            Body = body, At = op.At };
        var changes = new List<RecordChange> { RecordChange.Create(Key(item.Id), "conversation", item), RecordChange.Create("inboxMessage:" + message.Id, "inboxMessage", message) };
        changes.AddRange(participants.Select(p => RecordChange.Create(MemberKey(item.Id, p), "conversationMember",
            new ConversationMember { ConversationId = item.Id, AccountId = p, LastReadAt = p == actor.AccountId ? op.At : null })));
        TrackNotices(parish, item, message, changes);
        await records.CommitAsync(RecordScopes.Parish(parish), op, "inbox.start", item.Id, changes, new CommandResult { Id = item.Id, Status = "Started" }, ct);
        await DispatchNoticesAsync(parish, item, message, ct);
        await PushAsync(parish, item, "inbox", ct);
        var result = await ProjectAsync(parish, item, ct);
        result.NotificationOutcome = await outcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
        return result;
    }

    // Office staff who may read the people list write to a person they see there: the person's one active linked account in this parish.
    // Without people.read the person route is unavailable, so it reveals nothing about who holds an account.
    private async Task<string> PersonAccountAsync(string parish, string person, CancellationToken ct)
    {
        try
        {
            await access.RequireAsync(parish, Permissions.PeopleRead, ct);
            await access.RequireModuleAsync(parish, "office", ct);
        }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { throw Missing(); }
        var links = (await records.CollectAsync<PersonAccountLink>(RecordScopes.Parish(parish), "personAccountLink", ct, 20, RecordConditions.Equal("personId", person)))
            .Select(r => r.Value).Where(l => l.Active && l.ParishId == parish && l.PersonId == person).Select(l => l.AccountId).Distinct(StringComparer.Ordinal).ToArray();
        return links.Length switch
        {
            1 => links[0],
            0 => throw new DomainException("invalid_input", "This person has no linked account in this parish, so nothing was sent."),
            _ => throw new DomainException("invalid_input", "This person has more than one linked account; nothing was sent. Resolve the links first.")
        };
    }

    public async Task<IReadOnlyList<ConversationDto>> ListAsync(string parish, CancellationToken ct)
    {
        var office = await IsOfficeAsync(parish, ct);
        if (!office) await own.PersonalAsync(ct);
        var ids = (await records.CollectAsync<ConversationMember>(RecordScopes.Parish(parish), "conversationMember", ct, 2000, RecordConditions.Equal("accountId", actor.AccountId)))
            .Select(m => m.Value.ConversationId).ToHashSet(StringComparer.Ordinal);
        var result = new List<ConversationDto>();
        var listed = new HashSet<string>(StringComparer.Ordinal);
        var shown = new List<string>(); // this account's list now shows a newer message than it last did: the sender's delivered tick
        foreach (var id in ids)
            if (await records.ReadAsync<Conversation>(RecordScopes.Parish(parish), Key(id), ct) is { } row
                && row.Value.ParticipantAccountIds.Contains(actor.AccountId, StringComparer.Ordinal)
                && (row.Value.Kind != "Direct" || row.Value.CreatedBy != actor.AccountId || office))
            {
                listed.Add(id);
                var member = await MemberAsync(parish, id, ct);
                result.Add(Project(row.Value, member));
                if (member?.SeenAt is not { } seen || seen < row.Value.LastMessageAt) shown.Add(id);
            }
        // The shared office inbox is visible to authorized office staff, each acting under their own account. Staff who opened a
        // member's Office conversation have a read-state row without being a participant, so only already-listed rows are skipped.
        if (office)
            foreach (var row in await records.CollectAsync<Conversation>(RecordScopes.Parish(parish), "conversation", ct, 2000, RecordConditions.Equal("kind", "Office")))
                if (!listed.Contains(row.Value.Id))
                {
                    var member = await MemberAsync(parish, row.Value.Id, ct);
                    result.Add(Project(row.Value, member));
                    if (member is not null && (member.SeenAt is not { } seen || seen < row.Value.LastMessageAt)) shown.Add(row.Value.Id);
                }
        var now = clock.GetUtcNow();
        foreach (var id in shown)
            await SetMemberAsync(parish, id, m => m.SeenAt = now, ct);
        return result.OrderByDescending(c => c.LastMessageAt).ToArray();
    }

    public async Task<IReadOnlyList<InboxMessageDto>> MessagesAsync(string parish, string id, CancellationToken ct)
    {
        var item = await AccessibleAsync(parish, id, ct);
        var messages = await records.CollectAsync<InboxMessage>(RecordScopes.Parish(parish), "inboxMessage", ct, 2000, RecordConditions.Equal("conversationId", id));
        var now = clock.GetUtcNow();
        await SetMemberAsync(parish, item.Id, m => { m.LastReadAt = now; m.SeenAt = now; }, ct);
        await PushAsync(parish, item, "inbox-read", ct);
        // The ticks on the caller's own messages come from the other side's state: the member for staff, the office staff who opened it for a
        // member writing to the office, the other participant in a direct chat. Opening implies the list showed it.
        var participant = item.ParticipantAccountIds.Contains(actor.AccountId, StringComparer.Ordinal);
        var others = (await records.CollectAsync<ConversationMember>(RecordScopes.Parish(parish), "conversationMember", ct, 2000, RecordConditions.Equal("conversationId", id)))
            .Select(r => r.Value)
            .Where(m => m.AccountId != actor.AccountId && m.ConversationId == id
                && item.ParticipantAccountIds.Contains(m.AccountId, StringComparer.Ordinal) != (item.Kind == "Office" && participant))
            .ToArray();
        var read = others.Max(m => m.LastReadAt);
        var seen = others.Select(m => m.SeenAt > m.LastReadAt || m.LastReadAt is null ? m.SeenAt : m.LastReadAt).Max();
        return messages.Select(m => m.Value).OrderBy(m => m.At).ThenBy(m => m.Id, StringComparer.Ordinal)
            .Select(m =>
            {
                var view = Project(m);
                if (m.AuthorAccountId == actor.AccountId)
                {
                    view.Read = read >= m.At;
                    view.Delivered = view.Read == true || seen >= m.At;
                }
                return view;
            }).ToArray();
    }

    public async Task<InboxMessageDto> PostAsync(string parish, string id, PostInboxMessageDto request, CancellationToken ct)
    {
        var row = await records.ReadAsync<Conversation>(RecordScopes.Parish(parish), Key(id), ct) ?? throw Missing();
        await AccessibleAsync(parish, id, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "inbox-message:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(RecordScopes.Parish(parish), op, ct) is { } prior)
            return await MessageViewAsync(parish, (await records.ReadAsync<InboxMessage>(RecordScopes.Parish(parish), "inboxMessage:" + prior.Id, ct))!.Value, ct);
        var message = await AppendAsync(parish, row, op, new InboxMessage { Body = Guard.Text(request.Body, "Message", 10000) }, "inbox.message", ct);
        return await MessageViewAsync(parish, message, ct);
    }

    // A voice note: the browser's recording (WebM/Ogg Opus, or MP4/AAC from Safari), checked by its content, stored privately before the
    // message commits, like evidence files. Seconds is the sender's own measure, shown on the player.
    public async Task<InboxMessageDto> PostVoiceAsync(string parish, string id, Guid operationId, byte[] content, int seconds, CancellationToken ct)
    {
        var row = await records.ReadAsync<Conversation>(RecordScopes.Parish(parish), Key(id), ct) ?? throw Missing();
        await AccessibleAsync(parish, id, ct);
        if (content.Length == 0 || content.Length > MaximumVoiceBytes)
            throw new DomainException("invalid_file", "A voice message must be between 1 byte and 5 MB.");
        if (seconds is < 1 or > 600)
            throw new DomainException("invalid_input", "A voice message lasts from 1 second to 10 minutes.");
        var type = DetectAudio(content) ?? throw new DomainException("invalid_file", "Record the voice message again; its audio format was not recognised.");
        var digest = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(content));
        var op = actor.CreateOperation(operationId, new { conversation = id, size = content.Length, digest, seconds }, clock, "inbox-voice:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(RecordScopes.Parish(parish), op, ct) is { } prior)
            return await MessageViewAsync(parish, (await records.ReadAsync<InboxMessage>(RecordScopes.Parish(parish), "inboxMessage:" + prior.Id, ct))!.Value, ct);
        var voice = new InboxVoice { StoragePath = parish + "/voice/" + op.Id, ContentType = type, Size = content.Length, Sha256 = digest, Seconds = seconds };
        await store.PutAsync(voice.StoragePath, content, type, ct);
        await AccessibleAsync(parish, id, ct); // still allowed after the upload
        var message = await AppendAsync(parish, row, op, new InboxMessage { Body = VoiceBody, Voice = voice }, "inbox.voice", ct);
        return await MessageViewAsync(parish, message, ct);
    }

    public async Task<(byte[] Content, string ContentType)> VoiceAsync(string parish, string conversation, string id, CancellationToken ct)
    {
        await AccessibleAsync(parish, conversation, ct);
        var row = await records.ReadAsync<InboxMessage>(RecordScopes.Parish(parish), "inboxMessage:" + id, ct);
        if (row?.Value is not { Voice: { } voice } message || message.Id != id || message.ConversationId != conversation) throw Missing();
        var content = await store.OpenAsync(voice.StoragePath, ct) ?? throw Missing();
        if (content.Length != voice.Size || !string.Equals(Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(content)), voice.Sha256, StringComparison.Ordinal))
            throw new DomainException("evidence_integrity_unavailable", "The stored voice message failed its integrity check.", FailureKind.Unavailable);
        return (content, voice.ContentType);
    }

    // Only the bytes decide: Matroska/WebM, Ogg, or an MP4 'ftyp' box.
    internal static string? DetectAudio(byte[] content) => content switch
    {
        [0x1A, 0x45, 0xDF, 0xA3, ..] => "audio/webm",
        [0x4F, 0x67, 0x67, 0x53, ..] => "audio/ogg",
        [_, _, _, _, 0x66, 0x74, 0x79, 0x70, ..] => "audio/mp4",
        _ => null
    };

    // Adds one message to a conversation the caller may write in (the receipt names resultId: the conversation for a start that joined a chat): the message, the conversation's new time, the caller's own read state
    // (and the chat back out of the archive for every participant who archived it, as a chat app does), the notices; then the live push.
    private async Task<InboxMessage> AppendAsync(string parish, Versioned<Conversation> row, Operation op, InboxMessage message, string action, CancellationToken ct,
        string? resultId = null)
    {
        var item = row.Value;
        // Staff replying in a member's office conversation write for the parish office, attributed to their own account.
        message.Id = op.Id;
        message.ConversationId = item.Id;
        message.AuthorAccountId = actor.AccountId;
        message.Capacity = item.Kind == "Office" && !item.ParticipantAccountIds.Contains(actor.AccountId) || item.Kind == "Direct" && item.CreatedBy == actor.AccountId ? "Office" : "Self";
        message.At = op.At;
        item.LastMessageAt = op.At;
        var changes = new List<RecordChange>
        {
            RecordChange.Create("inboxMessage:" + message.Id, "inboxMessage", message),
            RecordChange.Replace(Key(item.Id), "conversation", item, row.Version)
        };
        foreach (var account in item.ParticipantAccountIds.Append(actor.AccountId).Distinct(StringComparer.Ordinal))
        {
            var key = MemberKey(item.Id, account);
            var state = await records.ReadAsync<ConversationMember>(RecordScopes.Parish(parish), key, ct);
            var mine = account == actor.AccountId;
            if (!mine && state?.Value.Archived != true) continue;
            var value = state?.Value ?? new ConversationMember { ConversationId = item.Id, AccountId = account };
            value.Archived = false;
            if (mine) value.LastReadAt = value.SeenAt = op.At;
            changes.Add(state is null ? RecordChange.Create(key, "conversationMember", value) : RecordChange.Replace(key, "conversationMember", value, state.Version));
        }
        TrackNotices(parish, item, message, changes);
        await records.CommitAsync(RecordScopes.Parish(parish), op, action, item.Id, changes, new CommandResult { Id = resultId ?? message.Id, Status = "Sent" }, ct);
        await DispatchNoticesAsync(parish, item, message, ct);
        await PushAsync(parish, item, "inbox", ct);
        return message;
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
        var item = (await records.ReadAsync<Conversation>(RecordScopes.Parish(parish), Key(id), ct) ?? throw Missing()).Value;
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
        var row = await records.ReadAsync<ConversationMember>(RecordScopes.Parish(parish), key, ct);
        var value = row?.Value ?? new ConversationMember { ConversationId = conversation, AccountId = actor.AccountId };
        change(value);
        try
        {
            await records.CommitAsync(RecordScopes.Parish(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { conversation }, clock), "inbox.state", conversation,
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
        var row = await records.ReadAsync<InboxMessage>(RecordScopes.Parish(parish), "inboxMessage:" + id, ct);
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

    // The caller's latest chat of this kind with exactly these people in this parish.
    private async Task<Versioned<Conversation>?> SameChatAsync(string parish, string kind, string[] participants, CancellationToken ct)
    {
        var wanted = participants.ToHashSet(StringComparer.Ordinal);
        Versioned<Conversation>? best = null;
        foreach (var member in await records.CollectAsync<ConversationMember>(RecordScopes.Parish(parish), "conversationMember", ct, 2000, RecordConditions.Equal("accountId", actor.AccountId)))
            if (await records.ReadAsync<Conversation>(RecordScopes.Parish(parish), Key(member.Value.ConversationId), ct) is { } row
                && row.Value.ParishId == parish && row.Value.Kind == kind && wanted.SetEquals(row.Value.ParticipantAccountIds)
                && (best is null || row.Value.LastMessageAt > best.Value.LastMessageAt))
                best = row;
        return best;
    }

    private static string FirstLine(string body)
    {
        var line = body.Split('\n', 2)[0].Trim();
        return line.Length <= 80 ? line : line[..79].TrimEnd() + "…";
    }

    // Tells the other people of a conversation, in their open tabs, that it changed: the participants and the staff who have opened it.
    private async Task PushAsync(string parish, Conversation item, string type, CancellationToken ct)
    {
        var watchers = (await records.CollectAsync<ConversationMember>(RecordScopes.Parish(parish), "conversationMember", ct, 2000, RecordConditions.Equal("conversationId", item.Id)))
            .Select(m => m.Value.AccountId);
        foreach (var account in item.ParticipantAccountIds.Concat(watchers).Where(a => a != actor.AccountId).Distinct(StringComparer.Ordinal))
            live.Publish(account, new { type, parishId = parish, conversationId = item.Id });
    }

    private async Task<ConversationMember?> MemberAsync(string parish, string conversation, CancellationToken ct)
        => (await records.ReadAsync<ConversationMember>(RecordScopes.Parish(parish), MemberKey(conversation, actor.AccountId), ct))?.Value;

    private async Task<Versioned<Conversation>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<Conversation>(RecordScopes.Parish(parish), Key(id), ct) ?? throw Missing();

    private async Task<ConversationDto> ProjectAsync(string parish, Conversation x, CancellationToken ct)
        => Project(x, await MemberAsync(parish, x.Id, ct));

    private static ConversationDto Project(Conversation x, ConversationMember? member)
    {
        return new ConversationDto
        {
            Id = x.Id, Kind = x.Kind, Subject = x.Subject, ParticipantAccountIds = [.. x.ParticipantAccountIds], CreatedBy = x.CreatedBy, LastMessageAt = x.LastMessageAt,
            Unread = member?.LastReadAt is not { } read || read < x.LastMessageAt, Archived = member?.Archived == true
        };
    }

    private static InboxMessageDto Project(InboxMessage m) => new()
    {
        Id = m.Id, AuthorAccountId = m.AuthorAccountId, Capacity = m.Capacity, Body = m.Body, At = m.At, VoiceSeconds = m.Voice?.Seconds, VoiceType = m.Voice?.ContentType
    };
}
