// Purpose: runs confidential concerns: bishop-appointed independent reviewers, submitter-chosen reviewers with implicated people excluded,
// anonymous or identified submission, fixed-audience entries and reviewer/submitter transitions. Nobody else receives cases, counts or signals.
// Main functions: AppointReviewerAsync, EndReviewerAsync, ReviewerOptionsAsync, SubmitAsync, ActAsync, PostEntryAsync, EntriesAsync,
// GetAsync, OwnAsync, AssignedAsync and reviewer-only NotificationOutcomeAsync/EntryNotificationOutcomeAsync; helpers enforce current reviewer eligibility on every request.
// Required submitter notices are staged in the same source transaction, without copying confidential content into previews.

using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Care;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Care;

public class ConcernService(IRecordTransactions records, IParishRepository parishes, IArchdioceseAuthority bishops, IAccountDirectory accounts,
    MinistryAccess own, ICurrentActor actor, MfaAccountAccess proof, IDataProtectionProvider protection, NotificationService notifications, TimeProvider clock,
    NotificationOutcomeReader outcomes)
{
    private static readonly string[] Categories = ["Operational", "Interpersonal", "Safeguarding", "Other"];
    private static RecordScope Parish(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordScope Archdiocese(string id) => new() { Area = RecordArea.Archdiocese, OwnerId = id };
    private static string Key(string id) => "concern:" + id;
    private static string ReviewerKey(string id) => "concernReviewer:" + id;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested case is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_concern_state", message, FailureKind.Conflict);
    private IDataProtector Protector(string parish, string id) => protection.CreateProtector("ParishLife.Concerns.v1", parish, id);

    public async Task<ReviewerOptionDto> AppointReviewerAsync(string archdiocese, AppointReviewerDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await bishops.RequireBishopAsync(archdiocese, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "concern-reviewer:v1:" + archdiocese);
        if (await records.ReplayAsync<CommandResult>(Archdiocese(archdiocese), op, ct) is { } prior)
            return Option((await records.ReadAsync<ConcernReviewer>(Archdiocese(archdiocese), ReviewerKey(prior.Id), ct))!.Value);
        var account = Guard.Id(request.AccountId);
        if (account == actor.AccountId || !await accounts.IsActiveVerifiedAsync(account, ct))
            throw new DomainException("invalid_input", "Appoint another active verified account as reviewer.");
        if (request.Categories is null || request.Categories.Length is < 1 or > 4 || request.Categories.Any(c => !Categories.Contains(c))
            || request.Categories.Distinct().Count() != request.Categories.Length)
            throw new DomainException("invalid_input", "Use distinct Operational, Interpersonal, Safeguarding or Other categories.");
        var reviewer = new ConcernReviewer
        {
            Id = op.Id, ArchdioceseId = archdiocese, AccountId = account, Description = Guard.Text(request.Description, "Description", 500),
            Categories = [.. request.Categories], CanViewIdentity = request.CanViewIdentity, Active = true, AppointedBy = actor.AccountId,
            AppointedAt = op.At, EvidenceReference = Guard.Text(request.EvidenceReference, "Evidence", 1000)
        };
        await records.CommitAsync(Archdiocese(archdiocese), op, "care.reviewer_appoint", reviewer.Id,
            [RecordChange.Create(ReviewerKey(reviewer.Id), "concernReviewer", reviewer)], new CommandResult { Id = reviewer.Id, Status = "Active" }, ct);
        return Option(reviewer);
    }

    public async Task<ReviewerOptionDto> EndReviewerAsync(string archdiocese, string reviewer, EndReviewerDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await bishops.RequireBishopAsync(archdiocese, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "concern-reviewer-end:v1:" + reviewer);
        var row = await records.ReadAsync<ConcernReviewer>(Archdiocese(archdiocese), ReviewerKey(reviewer), ct) ?? throw Missing();
        if (await records.ReplayAsync<CommandResult>(Archdiocese(archdiocese), op, ct) is not null)
            return Option(row.Value);
        if (!row.Value.Active)
            throw State("This reviewer appointment has already ended.");
        Guard.Text(request.Reason, "Reason", 2000);
        // Ending access never transfers the reviewer's cases to a successor; affected cases need an independent handover.
        row.Value.Active = false;
        row.Value.EndedAt = op.At;
        await records.CommitAsync(Archdiocese(archdiocese), op, "care.reviewer_end", reviewer,
            [RecordChange.Replace(ReviewerKey(reviewer), "concernReviewer", row.Value, Versions.Require(request.Version))], new CommandResult { Id = reviewer, Status = "Ended" }, ct);
        return Option(row.Value);
    }

    public async Task<IReadOnlyList<ReviewerOptionDto>> ReviewerOptionsAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var archdiocese = await ArchdioceseAsync(parish, ct);
        return (await ActiveReviewersAsync(archdiocese, ct)).Select(Option).ToArray();
    }

    public async Task<ConcernDto> SubmitAsync(string parish, SubmitConcernDto request, CancellationToken ct)
    {
        // Any signed-in personal account may raise a concern; parish membership is not required.
        await own.PersonalAsync(ct);
        var archdiocese = await ArchdioceseAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "concern:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Parish(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value, null);
        if (!Categories.Contains(request.Category) || request.Urgency is not ("Normal" or "Urgent") || request.ReviewerIds is null || request.ImplicatedAccountIds is null)
            throw new DomainException("invalid_input", "Use a supported category and urgency.");
        var implicated = request.ImplicatedAccountIds.Select(Guard.Id).Distinct().ToArray();
        // Implicated people are excluded before anyone is selected, so they can never receive the case.
        var eligible = (await ActiveReviewersAsync(archdiocese, ct))
            .Where(r => r.Categories.Contains(request.Category) && !implicated.Contains(r.AccountId) && r.AccountId != actor.AccountId).ToList();
        var selected = request.ReviewerIds.Length == 0 ? eligible : eligible.Where(r => request.ReviewerIds.Contains(r.Id)).ToList();
        if (selected.Count == 0 || request.ReviewerIds.Length > 0 && selected.Count != request.ReviewerIds.Distinct().Count())
            throw State("No eligible independent reviewer is available for this category and choice; the concerns service is not ready here.");
        var content = new ConcernContent { Summary = Guard.Text(request.Summary, "Summary", 300), Details = request.Details ?? "" };
        if (content.Details.Length > 20000)
            throw new DomainException("invalid_input", "The details are too long.");
        var item = new Concern
        {
            Id = op.Id, ParishId = parish, ArchdioceseId = archdiocese, Category = request.Category, Urgency = request.Urgency,
            ApplicantAccountId = actor.AccountId, Anonymous = request.Anonymous, ImplicatedAccountIds = implicated,
            SelectedReviewerIds = selected.Select(r => r.Id).ToArray(), CreatedAt = op.At, UpdatedAt = op.At
        };
        item.ProtectedContent = Protector(parish, item.Id).Protect(JsonSerializer.Serialize(content));
        await records.CommitAsync(Parish(parish), op, "care.concern_submit", item.Id, [RecordChange.Create(Key(item.Id), "concern", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, null);
    }

    public async Task<ConcernDto> ActAsync(string parish, string id, ConcernActionDto request, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        var submitter = item.ApplicantAccountId == actor.AccountId;
        ConcernReviewer? reviewer = null;
        if (submitter)
            await own.PersonalAsync(ct);
        else
            reviewer = await RequireReviewerAsync(item, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "concern-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Parish(parish), op, ct) is not null)
            return await ActionViewAsync((await ReadAsync(parish, id, ct)).Value, reviewer, ct);
        switch (request.Action)
        {
            case "accept" when reviewer is not null && item.Status is "Submitted" or "Reopened" && (item.AssignedReviewerId is null || item.AssignedReviewerId == reviewer.Id):
                // Accepting confirms the reviewer is suitable for this scope and takes responsibility for the next action.
                item.AssignedReviewerId = reviewer.Id;
                item.Status = "Accepted";
                break;
            case "start-review" when reviewer is not null && reviewer.Id == item.AssignedReviewerId && item.Status is "Accepted" or "NeedsInformation":
                item.Status = "UnderReview";
                break;
            case "respond" when reviewer is not null && reviewer.Id == item.AssignedReviewerId && item.Status is "UnderReview" or "Accepted":
                item.Status = "ResponseProvided";
                break;
            case "close" when reviewer is not null && reviewer.Id == item.AssignedReviewerId && item.Status != "Closed":
                item.Status = "Closed";
                break;
            case "reopen" when item.Status == "Closed" && (submitter || reviewer?.Id == item.AssignedReviewerId):
                item.Status = "Reopened";
                break;
            case "identify" when submitter && item.Anonymous:
                // Voluntary identification is explicit and one-way; the earlier anonymous history is retained.
                item.Anonymous = false;
                item.IdentifiedAt = op.At;
                break;
            default:
                throw State("This action is not available to you on this case now.");
        }
        if (reviewer is not null && !string.IsNullOrWhiteSpace(request.NextAction))
            item.NextAction = Guard.Text(request.NextAction, "Next action", 500);
        item.UpdatedAt = op.At;
        var changes = new List<RecordChange> { RecordChange.Replace(Key(id), "concern", item, Versions.Require(request.Version)) };
        if (reviewer is not null)
        {
            var notice = SubmitterNotice(item, op);
            item.NotificationWorkIds = [((NotificationWork)notice.Value!).Id];
            changes.Add(notice);
        }
        await records.CommitAsync(Parish(parish), op, "care.concern_" + request.Action.Replace('-', '_'), id,
            changes, new CommandResult { Id = id, Status = item.Status }, ct);
        if (reviewer is not null)
            await notifications.DispatchAsync(parish, item.ApplicantAccountId, "concern:" + op.Id, ct);
        return await ActionViewAsync(item, reviewer, ct);
    }

    // Only a currently eligible selected reviewer learns whether the neutral submitter notice was stored in-app. It reveals no
    // identity or account detail, and Pending is not proof that no notice exists. Submitters use their own notification list.
    public async Task<NotificationOutcomeDto> NotificationOutcomeAsync(string parish, string id, CancellationToken ct)
    {
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.ApplicantAccountId == actor.AccountId) throw Missing();
        await RequireReviewerAsync(item, ct);
        return await outcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
    }

    public async Task<NotificationOutcomeDto> EntryNotificationOutcomeAsync(string parish, string id, string entry, CancellationToken ct)
    {
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.ApplicantAccountId == actor.AccountId) throw Missing();
        await RequireReviewerAsync(item, ct);
        var row = await records.ReadAsync<ConcernEntry>(Parish(parish), "concernEntry:" + entry, ct);
        if (row?.Value is not { } value || value.Id != entry || value.RequestId != id) throw Missing();
        return await outcomes.ReadAsync(parish, value.NotificationWorkIds, ct);
    }

    // ponytail: a reviewer's replay reports the latest reviewer notice; keep per-operation pointers if exact older replays need their own.
    private async Task<ConcernDto> ActionViewAsync(Concern item, ConcernReviewer? reviewer, CancellationToken ct)
    {
        var result = Project(item, reviewer);
        if (reviewer is not null)
            result.NotificationOutcome = await outcomes.ReadAsync(item.ParishId, item.NotificationWorkIds, ct);
        return result;
    }

    public async Task<ConcernEntryDto> PostEntryAsync(string parish, string id, PostConcernEntryDto request, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        var submitter = item.ApplicantAccountId == actor.AccountId;
        ConcernReviewer? reviewer = null;
        if (submitter)
        {
            await own.PersonalAsync(ct);
            if (request.Kind != "SubmitterMessage")
                throw Missing();
        }
        else
        {
            reviewer = await RequireReviewerAsync(item, ct);
            if (request.Kind == "SubmitterMessage")
                throw Missing();
        }
        var op = actor.CreateOperation(request.OperationId, request, clock, "concern-entry:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Parish(parish), op, ct) is not null)
            throw State("This entry was already recorded.");
        var entry = new ConcernEntry { Id = op.Id, RequestId = id, Kind = request.Kind, AuthorAccountId = actor.AccountId, At = op.At };
        entry.ProtectedBody = Protector(parish, id).Protect(Guard.Text(request.Body, "Entry", 10000));
        var changes = new List<RecordChange> { RecordChange.Create("concernEntry:" + entry.Id, "concernEntry", entry) };
        var status = request.Kind switch
        {
            "InformationRequest" when item.Status is "Accepted" or "UnderReview" => "NeedsInformation",
            "SubmitterMessage" when item.Status == "NeedsInformation" => "UnderReview",
            _ => item.Status
        };
        if (status != item.Status)
        {
            item.Status = status;
            item.UpdatedAt = op.At;
            changes.Add(RecordChange.Replace(Key(id), "concern", item, row.Version));
        }
        if (request.Kind is "MessageToSubmitter" or "InformationRequest")
        {
            var notice = SubmitterNotice(item, op);
            entry.NotificationWorkIds = [((NotificationWork)notice.Value!).Id];
            changes.Add(notice);
        }
        else if (reviewer is not null)
            entry.NotificationWorkIds = [];
        await records.CommitAsync(Parish(parish), op, "care.concern_entry", id, changes, new CommandResult { Id = entry.Id, Status = entry.Kind }, ct);
        if (request.Kind is "MessageToSubmitter" or "InformationRequest")
            await notifications.DispatchAsync(parish, item.ApplicantAccountId, "concern:" + op.Id, ct);
        var result = Project(parish, entry);
        if (reviewer is not null)
            result.NotificationOutcome = await outcomes.ReadAsync(parish, entry.NotificationWorkIds, ct);
        return result;
    }

    public async Task<IReadOnlyList<ConcernEntryDto>> EntriesAsync(string parish, string id, CancellationToken ct)
    {
        var item = (await ReadAsync(parish, id, ct)).Value;
        var submitter = item.ApplicantAccountId == actor.AccountId;
        if (submitter)
            await own.PersonalAsync(ct);
        else
            await RequireReviewerAsync(item, ct);
        var rows = await records.CollectAsync<ConcernEntry>(Parish(parish), "concernEntry", ct, 1000, Equal("requestId", id));
        // Submitters see only the entries addressed to them; reviewer-only notes never leave the reviewer audience.
        return rows.Select(r => r.Value).Where(e => !submitter || e.Kind != "ReviewerNote")
            .OrderBy(e => e.At).ThenBy(e => e.Id, StringComparer.Ordinal).Select(e => Project(parish, e)).ToArray();
    }

    public async Task<Versioned<ConcernDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        ConcernReviewer? reviewer = null;
        if (row.Value.ApplicantAccountId == actor.AccountId)
            await own.PersonalAsync(ct);
        else
            reviewer = await RequireReviewerAsync(row.Value, ct);
        return new Versioned<ConcernDto> { Version = row.Version, Value = Project(row.Value, reviewer) };
    }

    // Submitters keep their own tracking even after leaving the parish.
    public async Task<IReadOnlyList<Versioned<ConcernDto>>> OwnAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var rows = await records.CollectAsync<Concern>(Parish(parish), "concern", ct, 500, Equal("applicantAccountId", actor.AccountId));
        return rows.Select(r => new Versioned<ConcernDto> { Version = r.Version, Value = Project(r.Value, null) }).ToArray();
    }

    // ponytail: filters this parish's cases in memory (bounded to 2000); index selected reviewers if a parish ever exceeds that.
    public async Task<IReadOnlyList<Versioned<ConcernDto>>> AssignedAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var archdiocese = await ArchdioceseAsync(parish, ct);
        var mine = (await ActiveReviewersAsync(archdiocese, ct)).Where(r => r.AccountId == actor.AccountId).ToList();
        if (mine.Count == 0)
            return [];
        var rows = await records.CollectAsync<Concern>(Parish(parish), "concern", ct, 2000);
        return rows.Select(r => (Row: r, Reviewer: mine.FirstOrDefault(m => r.Value.SelectedReviewerIds.Contains(m.Id) && m.Categories.Contains(r.Value.Category)
                && !r.Value.ImplicatedAccountIds.Contains(m.AccountId))))
            .Where(x => x.Reviewer is not null)
            .Select(x => new Versioned<ConcernDto> { Version = x.Row.Version, Value = Project(x.Row.Value, x.Reviewer) }).ToArray();
    }

    // The notice names no category, subject, identity or accusation, so lock screens and previews reveal nothing.
    private RecordChange SubmitterNotice(Concern item, Operation op)
        => notifications.StageRequired(item.ParishId, item.ApplicantAccountId, "concern.update", "There is an update to your confidential case.",
            "/api/parishes/" + item.ParishId + "/concerns/" + item.Id, "concern:" + op.Id, "ConcernApplicant", item.Id, op.At);

    private async Task<ConcernReviewer> RequireReviewerAsync(Concern item, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        // Eligibility is rechecked on every request: an ended appointment or a later implication stops access immediately.
        var reviewer = (await ActiveReviewersAsync(item.ArchdioceseId, ct)).FirstOrDefault(r => r.AccountId == actor.AccountId && item.SelectedReviewerIds.Contains(r.Id));
        if (reviewer is null || !reviewer.Categories.Contains(item.Category) || item.ImplicatedAccountIds.Contains(reviewer.AccountId))
            throw Missing();
        return reviewer;
    }

    private async Task<string> ArchdioceseAsync(string parish, CancellationToken ct)
    {
        var root = await parishes.GetAsync(parish, ct) ?? throw Missing();
        if (root.Value.Status != ParishStatus.Verified || root.Value.JurisdictionArchdioceseId is not { } archdiocese)
            throw State("No independent concern authority is configured for this parish yet.");
        return archdiocese;
    }

    private async Task<List<ConcernReviewer>> ActiveReviewersAsync(string archdiocese, CancellationToken ct)
        => (await records.CollectAsync<ConcernReviewer>(Archdiocese(archdiocese), "concernReviewer", ct, 200)).Select(r => r.Value).Where(r => r.Active).ToList();

    private async Task<Versioned<Concern>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<Concern>(Parish(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static ReviewerOptionDto Option(ConcernReviewer x) => new() { Id = x.Id, Description = x.Description, Categories = [.. x.Categories] };

    private ConcernDto Project(Concern x, ConcernReviewer? reviewer)
    {
        var content = JsonSerializer.Deserialize<ConcernContent>(Protector(x.ParishId, x.Id).Unprotect(x.ProtectedContent)) ?? new ConcernContent();
        return new ConcernDto
        {
            Id = x.Id, Category = x.Category, Urgency = x.Urgency, Summary = content.Summary, Details = content.Details, Anonymous = x.Anonymous,
            // Identity reaches a reviewer only for an identified case and a reviewer holding that separate capability.
            SubmitterAccountId = reviewer is null ? null : !x.Anonymous && reviewer.CanViewIdentity ? x.ApplicantAccountId : null,
            Status = x.Status, AssignedToMe = reviewer is not null && reviewer.Id == x.AssignedReviewerId, NextAction = x.NextAction,
            CreatedAt = x.CreatedAt, UpdatedAt = x.UpdatedAt
        };
    }

    private ConcernEntryDto Project(string parish, ConcernEntry x) => new()
    {
        Id = x.Id, Kind = x.Kind, Body = Protector(parish, x.RequestId).Unprotect(x.ProtectedBody), FromReviewer = x.Kind != "SubmitterMessage", At = x.At
    };
}
