// Purpose: runs exact-message reports and exceptional exact-message review (N02, proposed S26.16/S02.13/P26). A participant reports one
// message; a platform operator requests review of one exact message with a recorded reason; a different operator approves a short access
// window or declines; only the requester reads that one message inside the window, and every read is audited. No browse-all inbox exists.
// Main functions: ReportAsync, OwnReportsAsync, ReportsAsync, CloseReportAsync, RequestAsync, ListAsync, DecideAsync, ReadMessageAsync and CloseAsync.
// Helpers: OperatorAsync (current MFA platform operator), ConflictedAsync (participants and authors in the conversation are excluded).

using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Communications;

public class MessageReviewService(IRecordTransactions records, IParishRepository parishes, IPlatformAccess platform, InboxService inbox,
    ICurrentActor actor, MfaAccountAccess proof, IDataProtectionProvider protection, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested item is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_message_review_state", message, FailureKind.Conflict);
    private IDataProtector Protector(string parish, string id) => protection.CreateProtector("ParishLife.MessageReports.v1", parish, id);

    // Platform rank is necessary but never sufficient: every action below adds a reason, conflict exclusion and, for access, independent approval.
    private async Task OperatorAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await platform.RequireOperatorAsync(ct);
        _ = await parishes.GetAsync(parish, ct) ?? throw Missing();
    }

    // Anyone in the conversation, its creator or any author of a message in it is conflicted and cannot request, approve, read or close.
    private async Task<bool> ConflictedAsync(string parish, Conversation conversation, CancellationToken ct)
    {
        if (conversation.CreatedBy == actor.AccountId || conversation.ParticipantAccountIds.Contains(actor.AccountId, StringComparer.Ordinal)) return true;
        var messages = await records.CollectAsync<InboxMessage>(Scope(parish), "inboxMessage", ct, 2000, Equal("conversationId", conversation.Id));
        return messages.Any(m => m.Value.AuthorAccountId == actor.AccountId);
    }

    private async Task RequireUnconflictedAsync(string parish, string conversationId, CancellationToken ct)
    {
        var conversation = await records.ReadAsync<Conversation>(Scope(parish), "conversation:" + conversationId, ct);
        if (conversation?.Value is not { } value || value.Id != conversationId || value.ParishId != parish) throw Missing();
        if (await ConflictedAsync(parish, value, ct))
            throw new DomainException("message_review_conflicted", "A participant in this conversation cannot handle its review.", FailureKind.Forbidden);
    }

    private async Task<InboxMessage> MessageAsync(string parish, string conversation, string message, CancellationToken ct)
    {
        var row = await records.ReadAsync<InboxMessage>(Scope(parish), "inboxMessage:" + message, ct);
        return row?.Value is { } value && value.Id == message && value.ConversationId == conversation ? value : throw Missing();
    }

    public async Task<MessageReportDto> ReportAsync(string parish, string conversation, string message, ReportMessageDto request, CancellationToken ct)
    {
        // The participant's normal inbox access gate (personal or office) applies; recovery sessions are refused there.
        await inbox.AccessibleAsync(parish, conversation, ct);
        var reported = await MessageAsync(parish, conversation, message, ct);
        if (reported.AuthorAccountId == actor.AccountId)
            throw new DomainException("invalid_input", "Report a message someone else sent.");
        var op = actor.CreateOperation(request.OperationId, request, clock, "message-report:v1:" + message);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project(await ReadReportAsync(parish, prior.Id, ct), reviewer: false);
        var item = new MessageReport
        {
            Id = op.Id, ParishId = parish, ConversationId = conversation, MessageId = message, ReporterAccountId = actor.AccountId, CreatedAt = op.At
        };
        item.ProtectedExplanation = Protector(parish, item.Id).Protect(Guard.Text(request.Explanation, "Explanation", 4000));
        await records.CommitAsync(Scope(parish), op, "inbox.message_report", item.Id,
            [RecordChange.Create("messageReport:" + item.Id, "messageReport", item)], new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, reviewer: false);
    }

    public async Task<IReadOnlyList<MessageReportDto>> OwnReportsAsync(string parish, CancellationToken ct)
    {
        if (proof.RecoverySession) throw Missing();
        await proof.CurrentAsync(ct);
        return (await records.CollectAsync<MessageReport>(Scope(parish), "messageReport", ct, 500, Equal("reporterAccountId", actor.AccountId)))
            .OrderByDescending(r => r.Value.CreatedAt).Select(r => Project(r.Value, reviewer: false)).ToArray();
    }

    // ponytail: in-memory conflict filter over at most 500 reports per parish; add a status/conversation index if report volume grows.
    public async Task<IReadOnlyList<Versioned<MessageReportDto>>> ReportsAsync(string parish, CancellationToken ct)
    {
        await OperatorAsync(parish, ct);
        var result = new List<Versioned<MessageReportDto>>();
        foreach (var row in await records.CollectAsync<MessageReport>(Scope(parish), "messageReport", ct, 500))
        {
            var conversation = await records.ReadAsync<Conversation>(Scope(parish), "conversation:" + row.Value.ConversationId, ct);
            if (conversation is null || await ConflictedAsync(parish, conversation.Value, ct)) continue;
            result.Add(new Versioned<MessageReportDto> { Version = row.Version, Value = Project(row.Value, reviewer: true) });
        }
        return result.OrderByDescending(r => r.Value.CreatedAt).ToArray();
    }

    public async Task<MessageReportDto> CloseReportAsync(string parish, string id, CloseMessageReviewDto request, CancellationToken ct)
    {
        await OperatorAsync(parish, ct);
        var row = await ReadReportRowAsync(parish, id, ct);
        await RequireUnconflictedAsync(parish, row.Value.ConversationId, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "message-report-close:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(await ReadReportAsync(parish, id, ct), reviewer: true);
        if (row.Value.Status != "Received") throw State("This report is already closed.");
        var item = row.Value;
        item.Status = "Closed";
        item.ClosedAt = op.At;
        item.ReporterOutcome = Guard.Text(request.ReporterOutcome, "Reporter outcome", 500);
        await records.CommitAsync(Scope(parish), op, "inbox.message_report_close", id,
            [RecordChange.Replace("messageReport:" + id, "messageReport", item, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = item.Status }, ct, Guard.Text(request.Note, "Note", 2000));
        return Project(item, reviewer: true);
    }

    public async Task<MessageReviewDto> RequestAsync(string parish, RequestMessageReviewDto request, CancellationToken ct)
    {
        await OperatorAsync(parish, ct);
        var conversation = Guard.Id(request.ConversationId);
        var message = Guard.Id(request.MessageId);
        await MessageAsync(parish, conversation, message, ct);
        await RequireUnconflictedAsync(parish, conversation, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "message-review:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        string? report = null;
        if (request.ReportId is { } reportId)
        {
            var source = await ReadReportAsync(parish, Guard.Id(reportId), ct);
            if (source.MessageId != message || source.ConversationId != conversation || source.Status != "Received")
                throw State("The report must be open and about this exact message.");
            report = source.Id;
        }
        var reason = Guard.Text(request.Reason, "Reason", 2000);
        var item = new MessageReview
        {
            Id = op.Id, ParishId = parish, ConversationId = conversation, MessageId = message, ReportId = report, Reason = reason,
            RequestedBy = actor.AccountId, RequestedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "inbox.exact_message_review_request", item.Id,
            [RecordChange.Create("messageReview:" + item.Id, "messageReview", item)], new CommandResult { Id = item.Id, Status = item.Status }, ct, reason);
        return Project(item);
    }

    public async Task<IReadOnlyList<Versioned<MessageReviewDto>>> ListAsync(string parish, CancellationToken ct)
    {
        await OperatorAsync(parish, ct);
        return (await records.CollectAsync<MessageReview>(Scope(parish), "messageReview", ct, 500))
            .OrderByDescending(r => r.Value.RequestedAt).Select(r => new Versioned<MessageReviewDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    public async Task<MessageReviewDto> DecideAsync(string parish, string id, MessageReviewDecisionDto request, CancellationToken ct)
    {
        await OperatorAsync(parish, ct);
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        var op = actor.CreateOperation(request.OperationId, request, clock, "message-review-decision:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(item);
        // Independent approval: switching roles or capacities never makes the requester their own second approver.
        if (item.RequestedBy == actor.AccountId)
            throw new DomainException("independent_approval_required", "Another platform operator must decide this review.", FailureKind.Forbidden);
        await RequireUnconflictedAsync(parish, item.ConversationId, ct);
        if (item.Status != "Requested") throw State("This review has already been decided.");
        var approve = request.Approve ?? throw new DomainException("invalid_input", "Choose whether to approve the review.");
        if (approve)
        {
            var minutes = request.AccessMinutes is { } m and >= 5 and <= 1440 ? m
                : throw new DomainException("invalid_input", "An approved review needs an access window of 5 to 1440 minutes.");
            item.AccessUntil = op.At.AddMinutes(minutes);
        }
        item.Status = approve ? "Approved" : "Declined";
        item.DecidedBy = actor.AccountId;
        item.DecidedAt = op.At;
        item.DecisionReason = Guard.Text(request.Reason, "Reason", 2000);
        await records.CommitAsync(Scope(parish), op, "inbox.exact_message_review_" + (approve ? "approve" : "decline"), id,
            [RecordChange.Replace("messageReview:" + id, "messageReview", item, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = item.Status }, ct, item.DecisionReason);
        return Project(item);
    }

    // Each read is its own audited write; nothing else in the conversation (subject, other messages, participants) is returned.
    public async Task<ReviewedMessageDto> ReadMessageAsync(string parish, string id, CancellationToken ct)
    {
        await OperatorAsync(parish, ct);
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        if (item.RequestedBy != actor.AccountId) throw Missing();
        await RequireUnconflictedAsync(parish, item.ConversationId, ct);
        var now = clock.GetUtcNow();
        if (item.Status != "Approved" || item.AccessUntil is not { } until || now >= until)
            throw State("This review has no current approved access window.");
        var message = await MessageAsync(parish, item.ConversationId, item.MessageId, ct);
        item.ReadCount++;
        await records.CommitAsync(Scope(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { review = id }, clock), "inbox.exact_message_read", id,
            [RecordChange.Replace("messageReview:" + id, "messageReview", item, row.Version)], new CommandResult { Id = id, Status = item.Status }, ct, item.Reason);
        return new ReviewedMessageDto
        {
            ReviewId = id, ConversationId = message.ConversationId, MessageId = message.Id, AuthorAccountId = message.AuthorAccountId,
            Capacity = message.Capacity, Body = message.Body, At = message.At, AccessUntil = until
        };
    }

    public async Task<MessageReviewDto> CloseAsync(string parish, string id, CloseMessageReviewDto request, CancellationToken ct)
    {
        await OperatorAsync(parish, ct);
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        var op = actor.CreateOperation(request.OperationId, request, clock, "message-review-close:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(item);
        if (item.RequestedBy != actor.AccountId && item.DecidedBy != actor.AccountId) throw Missing();
        await RequireUnconflictedAsync(parish, item.ConversationId, ct);
        if (item.Status is not ("Requested" or "Approved")) throw State("This review is already finished.");
        item.Status = "Closed";
        item.ClosedBy = actor.AccountId;
        item.ClosedAt = op.At;
        item.ClosingNote = Guard.Text(request.Note, "Note", 2000);
        var changes = new List<RecordChange> { RecordChange.Replace("messageReview:" + id, "messageReview", item, Versions.Require(request.Version)) };
        if (item.ReportId is { } reportId)
        {
            // The originating report closes in the same parish transaction with only the neutral outcome chosen for the reporter.
            var report = await ReadReportRowAsync(parish, reportId, ct);
            if (report.Value.Status == "Received")
            {
                report.Value.Status = "Closed";
                report.Value.ClosedAt = op.At;
                report.Value.ReporterOutcome = Guard.Text(request.ReporterOutcome, "Reporter outcome", 500);
                changes.Add(RecordChange.Replace("messageReport:" + reportId, "messageReport", report.Value, report.Version));
            }
        }
        await records.CommitAsync(Scope(parish), op, "inbox.exact_message_review_close", id, changes, new CommandResult { Id = id, Status = item.Status }, ct, item.ClosingNote);
        return Project(item);
    }

    private async Task<Versioned<MessageReview>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<MessageReview>(Scope(parish), "messageReview:" + id, ct) is { } row && row.Value.Id == id && row.Value.ParishId == parish
            ? row : throw Missing();

    private async Task<Versioned<MessageReport>> ReadReportRowAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<MessageReport>(Scope(parish), "messageReport:" + id, ct) is { } row && row.Value.Id == id && row.Value.ParishId == parish
            ? row : throw Missing();

    private async Task<MessageReport> ReadReportAsync(string parish, string id, CancellationToken ct) => (await ReadReportRowAsync(parish, id, ct)).Value;

    private MessageReviewDto Project(MessageReview x) => new()
    {
        Id = x.Id, ConversationId = x.ConversationId, MessageId = x.MessageId, ReportId = x.ReportId, Reason = x.Reason,
        Status = x.Status == "Approved" && x.AccessUntil is { } until && clock.GetUtcNow() >= until ? "Expired" : x.Status,
        RequestedBy = x.RequestedBy, RequestedAt = x.RequestedAt, DecidedBy = x.DecidedBy, DecidedAt = x.DecidedAt, DecisionReason = x.DecisionReason,
        AccessUntil = x.AccessUntil, ClosedBy = x.ClosedBy, ClosedAt = x.ClosedAt, ClosingNote = x.ClosingNote, ReadCount = x.ReadCount
    };

    private MessageReportDto Project(MessageReport x, bool reviewer) => new()
    {
        Id = x.Id, ConversationId = x.ConversationId, MessageId = x.MessageId, Explanation = Protector(x.ParishId, x.Id).Unprotect(x.ProtectedExplanation),
        Status = x.Status, ReporterOutcome = x.ReporterOutcome, ReporterAccountId = reviewer ? x.ReporterAccountId : null, CreatedAt = x.CreatedAt, ClosedAt = x.ClosedAt
    };
}
