// Purpose: runs parish request cases from member, office (phone/paper/in person) or guest intake to closure with one stable reference.
// Main functions: SubmitAsync, GuestSubmitAsync, GuestGetAsync, GuestActAsync, ActAsync, SetChecklistAsync, PostMessageAsync, MessagesAsync,
// ClaimGuestAsync, DecideAssociationAsync, RotateTrackingAsync, HandoverAsync, GetAsync, OwnAsync, QueueAsync and HistoryAsync; helpers keep requester/subject/relationship/authority separate, keep distinct
// Received/Accepted/Approved-by-priest/Date-confirmed/Completed facts, and separate applicant-visible explanations from internal notes.
// Required applicant notices are staged with the source transition and dispatched independently after commit.
// NotificationOutcomeAsync and WithOutcomeAsync expose only this authorized case's latest tracked notice outcome, without recipient/work identifiers.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Requests;

public class RequestService(IRecordTransactions records, IParishAccess access, IClergyAuthority clergy, IAccountDirectory accounts,
    MinistryAccess own, ICurrentActor actor, MfaAccountAccess proof, NotificationService notifications, TimeProvider clock,
    NotificationOutcomeReader outcomes)
{
    internal static readonly string[] Terminal = ["Completed", "Declined", "Withdrawn", "Cancelled"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "request:" + id;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested case is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_request_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> OfficeAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.RequestsManage, ct);
        await access.RequireModuleAsync(parish, "requests", ct);
        return root;
    }

    private async Task<bool> IsOfficeAsync(string parish, CancellationToken ct)
    {
        try { await OfficeAsync(parish, ct); return true; }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { return false; }
    }

    public async Task<ParishRequestDto> SubmitAsync(string parish, SubmitRequestDto request, CancellationToken ct)
    {
        var office = request.Origin is not null;
        Versioned<Parish>? root = null;
        if (office)
            root = await OfficeAsync(parish, ct);
        else
        {
            await own.PersonalAsync(ct);
            await own.RootAsync(parish, ct);
            await access.RequireModuleAsync(parish, "requests", ct);
        }
        var op = actor.CreateOperation(request.OperationId, request, clock, "request:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value, office);
        var item = NewCase(parish, op, request.Kind, request.Summary, request.Details, request.PreferredDates, request.Relationship, request.AuthorityBasis, actor.AccountId);
        if (office)
        {
            // Staff entry records the real origin and requester; it is not the applicant's own digital submission or consent.
            item.Origin = request.Origin!;
            item.RequesterName = Guard.Text(request.RequesterName, "Requester name", 200);
            item.RequesterContact = Guard.Text(request.RequesterContact, "Requester contact", 300);
            if (request.SubjectPersonId is { } subject)
                item.SubjectPersonId = await PersonAsync(parish, Guard.Id(subject), ct);
        }
        else
        {
            // Applicants never pick hidden parish records; a linked member's own Person is used only for themselves.
            if (request.SubjectPersonId is not null)
                throw new DomainException("invalid_input", "The parish office matches the subject's record.");
            item.ApplicantAccountId = actor.AccountId;
            if (item.Relationship == "Self")
                item.SubjectPersonId = await OwnPersonAsync(parish, ct);
        }
        item.SubjectDescription = string.IsNullOrWhiteSpace(request.SubjectDescription) ? null : Guard.Text(request.SubjectDescription, "Subject", 1000);
        if (item.Relationship != "Self" && item.SubjectPersonId is null && item.SubjectDescription is null)
            throw new DomainException("invalid_input", "Describe who the request is for.");
        var changes = new List<RecordChange> { RecordChange.Create(Key(item.Id), "parishRequest", item), History(item, "submit", "", null, op, actor.AccountId) };
        if (root is not null)
            changes.Insert(0, Fence(root));
        await records.CommitAsync(Scope(parish), op, "request.submit", item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, office);
    }

    public async Task<GuestRequestReceiptDto> GuestSubmitAsync(string parish, GuestRequestDto request, CancellationToken ct)
    {
        await own.RootAsync(parish, ct);
        await access.RequireModuleAsync(parish, "requests", ct);
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var op = Operation.Create(request.OperationId, "guest", request, clock, "guest-request:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            throw State("This guest request was already received; use the tracking token returned the first time.");
        var item = NewCase(parish, op, request.Kind, request.Summary, request.Details, request.PreferredDates, request.Relationship, request.AuthorityBasis, "guest");
        item.Origin = "Guest";
        item.RequesterName = Guard.Text(request.RequesterName, "Requester name", 200);
        item.RequesterContact = Guard.Text(request.RequesterContact, "Requester contact", 300);
        item.SubjectDescription = Guard.Text(request.SubjectDescription, "Subject", 1000);
        item.GuestTokenHash = Hash(token);
        await records.CommitAsync(Scope(parish), op, "request.guest_submit", item.Id,
            [RecordChange.Create(Key(item.Id), "parishRequest", item), History(item, "submit", "", null, op, null)], new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return new GuestRequestReceiptDto { Reference = item.Reference, RequestId = item.Id, TrackingToken = token };
    }

    public async Task<ParishRequestDto> GuestGetAsync(string parish, string id, string? token, CancellationToken ct)
        => Project((await GuestCaseAsync(parish, id, token, ct)).Value, false);

    public async Task<ParishRequestDto> GuestActAsync(string parish, string id, string? token, RequestActionDto request, CancellationToken ct)
    {
        var row = await GuestCaseAsync(parish, id, token, ct);
        if (request.Action is not ("respond" or "withdraw"))
            throw State("A tracking token can only respond to a request for information or withdraw.");
        return await ApplicantActAsync(parish, row, request, "Guest", ct);
    }

    public async Task<ParishRequestDto> ActAsync(string parish, string id, RequestActionDto request, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        if (request.Action is "edit" or "withdraw" or "respond" or "request-cancel")
        {
            await own.PersonalAsync(ct);
            if (row.Value.ApplicantAccountId != actor.AccountId)
                throw Missing();
            return await ApplicantActAsync(parish, row, request, "Applicant", ct);
        }
        var root = await OfficeAsync(parish, ct);
        if (request.Action == "clergy-approve")
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await WithOutcomeAsync(parish, (await ReadAsync(parish, id, ct)).Value, true, ct);
        var item = row.Value;
        var previous = Copy(item);
        var open = !Terminal.Contains(item.Status);
        switch (request.Action)
        {
            case "triage" when open:
                if (request.AssignedTo is { } assigned)
                {
                    item.AssignedTo = Guard.Id(assigned);
                    if (!await accounts.IsActiveVerifiedAsync(item.AssignedTo, ct))
                        throw new DomainException("invalid_input", "Assign cases to an active verified account.");
                }
                if (request.Urgency is { } urgency)
                {
                    item.Urgency = urgency;
                    item.UrgencyReason = urgency == "Urgent" ? Guard.Text(request.UrgencyReason, "Urgency reason", 500) : null;
                }
                item.Deadline = request.Deadline is { } deadline ? Guard.Utc(deadline) : item.Deadline;
                item.NextAction = string.IsNullOrWhiteSpace(request.NextAction) ? item.NextAction : Guard.Text(request.NextAction, "Next action", 500);
                break;
            case "accept" when item.Status == "Received":
                // Acting for another person needs a reviewed authority basis before any work is accepted.
                if (item.Relationship != "Self" && !item.AuthorityReviewed)
                    throw State("Review the requester's authority for this subject before accepting.");
                item.Status = "AcceptedForProcessing";
                item.AcceptedAt = clock.GetUtcNow();
                break;
            case "return" when item.Status is "Received" or "AcceptedForProcessing":
                item.ApplicantExplanation = Guard.Text(request.Explanation, "Applicant-visible explanation", 2000);
                item.ResumeStatus = item.Status;
                item.Status = "NeedsInformation";
                break;
            case "decline" when item.Status is "Received" or "NeedsInformation" or "AcceptedForProcessing":
            case "cancel" when item.Status is "AcceptedForProcessing" or "CancellationRequested":
                item.ApplicantExplanation = Guard.Text(request.Explanation, "Applicant-visible explanation", 2000);
                item.Status = request.Action == "decline" ? "Declined" : "Cancelled";
                break;
            case "clergy-approve" when item.Status == "AcceptedForProcessing" && item.ClergyApprovedAt is null:
                item.ClergyApprovedBy = actor.AccountId;
                item.ClergyApprovedAt = clock.GetUtcNow();
                break;
            case "confirm-date" when item.Status == "AcceptedForProcessing":
                if (request.ConfirmedDate is not { } date || Guard.Utc(date) <= clock.GetUtcNow())
                    throw new DomainException("invalid_input", "A confirmed date must be a future UTC instant.");
                // A date is confirmed only once required evidence is in and, for sacramental work, a priest has approved.
                if (item.Checklist.Any(c => c.Required && c.Status == "Missing"))
                    throw State("Required checklist items are still missing.");
                if (item.Kind == "SacramentInquiry" && item.ClergyApprovedAt is null)
                    throw State("A priest approves sacramental requests before a date is confirmed.");
                item.ConfirmedDate = date;
                break;
            case "complete" when item.Status == "AcceptedForProcessing":
                if (item.ConfirmedDate is { } confirmed && confirmed > clock.GetUtcNow())
                    throw State("Complete the case after its confirmed date.");
                item.Status = "Completed";
                item.CompletedAt = clock.GetUtcNow();
                break;
            case "match-subject" when open:
                item.SubjectPersonId = await PersonAsync(parish, Guard.Id(request.SubjectPersonId ?? throw new DomainException("invalid_input", "Choose the subject's record.")), ct);
                Guard.Text(request.AuthorityEvidence, "Identity review evidence", 1000);
                break;
            case "review-authority" when open && item.Relationship != "Self":
                item.AuthorityBasis = (item.AuthorityBasis ?? "") + " | Reviewed: " + Guard.Text(request.AuthorityEvidence, "Authority evidence", 1000);
                item.AuthorityReviewed = true;
                break;
            case "link" when open || item.Status == "Completed":
                var link = new RequestLink { Kind = request.LinkKind ?? throw new DomainException("invalid_input", "Choose a link kind."),
                    RecordId = Guard.Id(request.LinkRecordId ?? throw new DomainException("invalid_input", "Choose the linked record.")) };
                if (item.Links.Length >= 20)
                    throw State("A case links at most 20 records.");
                if (!item.Links.Any(l => l.Kind == link.Kind && l.RecordId == link.RecordId))
                    item.Links = [.. item.Links, link];
                break;
            default:
                throw State("This action is not available in the case's current state.");
        }
        item.UpdatedAt = clock.GetUtcNow();
        // Applicant-visible changes notify a signed-in applicant; internal triage, matching and links do not.
        var recipient = request.Action is "accept" or "return" or "decline" or "cancel" or "clergy-approve" or "confirm-date" or "complete"
            ? item.ApplicantAccountId : null;
        var dedupKey = "request:" + op.Id;
        var changes = new List<RecordChange>
        {
            Fence(root), RecordChange.Replace(Key(id), "parishRequest", item, Versions.Require(request.Version)),
            History(item, request.Action, previous.Status, previous, op, actor.AccountId)
        };
        if (recipient is not null)
        {
            var notice = notifications.StageRequired(parish, recipient, "request.update", "There is an update to your request.",
                "/api/parishes/" + parish + "/requests/" + id, dedupKey, "RequestApplicant", id, op.At);
            item.NotificationWorkIds = [((NotificationWork)notice.Value!).Id];
            changes.Add(notice);
        }
        await records.CommitAsync(Scope(parish), op, "request." + request.Action.Replace('-', '_'), id,
            changes, new CommandResult { Id = id, Status = item.Status }, ct);
        if (recipient is not null)
            await notifications.DispatchAsync(parish, recipient, dedupKey, ct);
        return await WithOutcomeAsync(parish, item, true, ct);
    }

    public async Task<ParishRequestDto> SetChecklistAsync(string parish, string id, SetChecklistDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-checklist:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value, true);
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        if (Terminal.Contains(item.Status) || request.Items is null || request.Items.Length > 40
            || request.Items.Select(i => i.Key).Distinct(StringComparer.Ordinal).Count() != request.Items.Length)
            throw State("Set up to 40 distinct checklist items on an open case.");
        var previous = Copy(item);
        var old = item.Checklist.ToDictionary(c => c.Key, StringComparer.Ordinal);
        item.Checklist = request.Items.Select(i =>
        {
            if (i.Status is not ("Missing" or "Received" or "NotApplicable"))
                throw new DomainException("invalid_input", "Use Missing, Received or NotApplicable.");
            var reference = string.IsNullOrWhiteSpace(i.PaperReference) ? null : Guard.Text(i.PaperReference, "Paper reference", 500);
            if (i.Status == "Received" && reference is null)
                throw new DomainException("invalid_input", "Received evidence needs its paper or file reference.");
            var unchanged = old.TryGetValue(i.Key, out var before) && before.Status == i.Status && before.PaperReference == reference;
            return new RequestChecklistItem
            {
                Key = Guard.Text(i.Key, "Key", 40), Label = Guard.Text(i.Label, "Label", 300), Required = i.Required, Status = i.Status, PaperReference = reference,
                VerifiedBy = i.Status == "Missing" ? null : unchanged ? before!.VerifiedBy : actor.AccountId,
                VerifiedAt = i.Status == "Missing" ? null : unchanged ? before!.VerifiedAt : op.At
            };
        }).ToArray();
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "request.checklist", id,
            [Fence(root), RecordChange.Replace(Key(id), "parishRequest", item, Versions.Require(request.Version)), History(item, "checklist", previous.Status, previous, op, actor.AccountId)],
            new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item, true);
    }

    public async Task<RequestMessageDto> PostMessageAsync(string parish, string id, PostRequestMessageDto request, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        var office = row.Value.ApplicantAccountId != actor.AccountId && await IsOfficeAsync(parish, ct);
        if (!office)
        {
            await own.PersonalAsync(ct);
            if (row.Value.ApplicantAccountId != actor.AccountId || request.Audience != "Applicant")
                throw Missing();
        }
        return await AddMessageAsync(parish, row.Value, request, office ? "Office" : "Applicant", actor.AccountId, ct);
    }

    public async Task<RequestMessageDto> GuestMessageAsync(string parish, string id, string? token, PostRequestMessageDto request, CancellationToken ct)
    {
        var row = await GuestCaseAsync(parish, id, token, ct);
        if (request.Audience != "Applicant")
            throw Missing();
        return await AddMessageAsync(parish, row.Value, request, "Guest", null, ct);
    }

    public async Task<IReadOnlyList<RequestMessageDto>> MessagesAsync(string parish, string id, string? token, CancellationToken ct)
    {
        Versioned<ParishRequest> row;
        bool office;
        if (token is not null)
        {
            row = await GuestCaseAsync(parish, id, token, ct);
            office = false;
        }
        else
        {
            row = await ReadAsync(parish, id, ct);
            office = row.Value.ApplicantAccountId != actor.AccountId && await IsOfficeAsync(parish, ct);
            if (!office)
            {
                await own.PersonalAsync(ct);
                if (row.Value.ApplicantAccountId != actor.AccountId)
                    throw Missing();
            }
        }
        var rows = await records.CollectAsync<RequestMessage>(Scope(parish), "requestMessage", ct, 500, Equal("requestId", id));
        // Applicants and guests only ever receive applicant-visible messages; internal notes stay with the office.
        return rows.Select(r => r.Value).Where(m => office || m.Audience == "Applicant").OrderBy(m => m.At).ThenBy(m => m.Id, StringComparer.Ordinal)
            .Select(m => new RequestMessageDto { Id = m.Id, Audience = m.Audience, AuthorKind = m.AuthorKind, AuthorAccountId = office ? m.AuthorAccountId : null, Body = m.Body, At = m.At })
            .ToArray();
    }

    // A13: a signed-in account presents the guest tracking token; the office then verifies identity before the case joins the account.
    public async Task<ParishRequestDto> ClaimGuestAsync(string parish, string id, string? token, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var row = await GuestCaseAsync(parish, id, token, ct);
        var item = row.Value;
        if (item.ApplicantAccountId is not null)
            throw State("This request is already associated with an account.");
        if (item.ClaimantAccountId == actor.AccountId)
            return Project(item, false);
        if (item.ClaimantAccountId is not null)
            throw State("Another association is waiting for office review; contact the parish office.");
        var previous = Copy(item);
        item.ClaimantAccountId = actor.AccountId;
        item.UpdatedAt = clock.GetUtcNow();
        var op = Operation.Create(Guid.NewGuid(), actor.AccountId, new { id }, clock, "request-claim:v1:" + id);
        await records.CommitAsync(Scope(parish), op, "request.claim", id,
            [RecordChange.Replace(Key(id), "parishRequest", item, row.Version), History(item, "claim", item.Status, previous, op, actor.AccountId)],
            new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item, false);
    }

    public async Task<ParishRequestDto> DecideAssociationAsync(string parish, string id, RequestAssociationDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-association:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await WithOutcomeAsync(parish, (await ReadAsync(parish, id, ct)).Value, true, ct);
        var item = (await ReadAsync(parish, id, ct)).Value;
        var claimant = item.ClaimantAccountId ?? throw State("No account association is waiting for review.");
        if (claimant == actor.AccountId)
            throw State("A different authorized reviewer decides your own association.");
        var previous = Copy(item);
        var note = request.Approve
            ? "Association verified: " + Guard.Text(request.EvidenceReference, "Identity review evidence", 500)
            : "Association declined: " + Guard.Text(request.Reason, "Reason", 1000);
        if (request.Approve)
        {
            // The account now holds access, so the bearer tracking link stops working.
            item.ApplicantAccountId = claimant;
            item.GuestTokenHash = null;
        }
        item.ClaimantAccountId = null;
        item.UpdatedAt = op.At;
        var associationNotice = notifications.StageRequired(parish, claimant, "request.update", "There is an update to your request association.",
            request.Approve ? "/api/parishes/" + parish + "/requests/" + id : null, "request-association:" + op.Id, "RequestAssociation", id, op.At);
        item.NotificationWorkIds = [((NotificationWork)associationNotice.Value!).Id];
        await records.CommitAsync(Scope(parish), op, request.Approve ? "request.associate" : "request.association_decline", id,
            [Fence(root), RecordChange.Replace(Key(id), "parishRequest", item, Versions.Require(request.Version)),
             History(item, request.Approve ? "associate" : "association-decline", previous.Status, previous, op, actor.AccountId),
             MessageChange(item, "Internal", "Office", actor.AccountId, note, op),
             associationNotice],
            new CommandResult { Id = id, Status = item.Status }, ct);
        await notifications.DispatchAsync(parish, claimant, "request-association:" + op.Id, ct);
        return await WithOutcomeAsync(parish, item, true, ct);
    }

    // After identity review, a leaked tracking link is replaced; the new token is shown once to the office to pass on.
    public async Task<GuestRequestReceiptDto> RotateTrackingAsync(string parish, string id, RotateTrackingDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-rotate:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            throw State("This link was already replaced; replace it again to get a new token.");
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.GuestTokenHash is null || item.ApplicantAccountId is not null)
            throw State("Only an unassociated guest request has a tracking link.");
        var previous = Copy(item);
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        item.GuestTokenHash = Hash(token);
        item.ClaimantAccountId = null;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "request.rotate_tracking", id,
            [Fence(root), RecordChange.Replace(Key(id), "parishRequest", item, Versions.Require(request.Version)), History(item, "rotate-tracking", previous.Status, previous, op, actor.AccountId),
             MessageChange(item, "Internal", "Office", actor.AccountId, "Tracking link replaced: " + Guard.Text(request.Reason, "Reason", 1000), op)],
            new CommandResult { Id = id, Status = item.Status }, ct);
        return new GuestRequestReceiptDto { Reference = item.Reference, RequestId = item.Id, TrackingToken = token };
    }

    // O04: when an office holder leaves, their open cases move to another current requests.manage holder in batches, with history per case.
    public async Task<OfficeHandoverResultDto> HandoverAsync(string parish, OfficeHandoverDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.AccessManage, ct);
        var from = Guard.Id(request.FromAccountId);
        var to = Guard.Id(request.ToAccountId);
        if (from == to)
            throw new DomainException("invalid_input", "Choose a different account to take over the open cases.");
        var now = clock.GetUtcNow();
        if (!(await records.CollectAsync<AccessGrant>(Scope(parish), "grant", ct, 20, Equal("accountId", to))).Any(g => g.Value.Permits(Permissions.RequestsManage, now)))
            throw State("The new owner needs current requests.manage access in this parish.");
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-handover:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return new OfficeHandoverResultDto { Moved = int.Parse(prior.Status, System.Globalization.CultureInfo.InvariantCulture), Remaining = await OpenCountAsync(parish, from, ct) };
        var open = (await records.CollectAsync<ParishRequest>(Scope(parish), "parishRequest", ct, 5000))
            .Where(r => r.Value.AssignedTo == from && !Terminal.Contains(r.Value.Status)).OrderBy(r => r.Value.ReceivedAt).ToList();
        // Two changes per case plus the parish fence stay inside one transactional batch.
        var batch = open.Take(45).ToList();
        var changes = new List<RecordChange> { Fence(root) };
        foreach (var row in batch)
        {
            var previous = Copy(row.Value);
            row.Value.AssignedTo = to;
            row.Value.UpdatedAt = op.At;
            changes.Add(RecordChange.Replace(Key(row.Value.Id), "parishRequest", row.Value, row.Version));
            changes.Add(History(row.Value, "handover", previous.Status, previous, Operation.Create(Guid.NewGuid(), actor.AccountId, new { row.Value.Id, to }, clock), actor.AccountId));
        }
        await records.CommitAsync(Scope(parish), op, "request.handover", from, changes,
            new CommandResult { Id = from, Status = batch.Count.ToString(System.Globalization.CultureInfo.InvariantCulture) }, ct);
        return new OfficeHandoverResultDto { Moved = batch.Count, Remaining = open.Count - batch.Count };
    }

    internal async Task<int> OpenCountAsync(string parish, string account, CancellationToken ct)
        => (await records.CollectAsync<ParishRequest>(Scope(parish), "parishRequest", ct, 5000)).Count(r => r.Value.AssignedTo == account && !Terminal.Contains(r.Value.Status));

    public async Task<Versioned<ParishRequestDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        var office = row.Value.ApplicantAccountId != actor.AccountId && await IsOfficeAsync(parish, ct);
        if (!office)
        {
            await own.PersonalAsync(ct);
            if (row.Value.ApplicantAccountId != actor.AccountId)
                throw Missing();
        }
        return new Versioned<ParishRequestDto> { Version = row.Version, Value = await WithOutcomeAsync(parish, row.Value, office, ct) };
    }

    public async Task<NotificationOutcomeDto> NotificationOutcomeAsync(string parish, string id, CancellationToken ct)
        => (await GetAsync(parish, id, ct)).Value.NotificationOutcome!;

    private async Task<ParishRequestDto> WithOutcomeAsync(string parish, ParishRequest item, bool office, CancellationToken ct)
    {
        var result = Project(item, office);
        result.NotificationOutcome = await outcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
        return result;
    }

    public async Task<Page<Versioned<ParishRequestDto>>> OwnAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var page = await records.PageAsync<ParishRequest>(Scope(parish), "parishRequest", size, cursor, ct, Equal("applicantAccountId", actor.AccountId));
        return ProjectPage(page, false);
    }

    public async Task<Page<Versioned<ParishRequestDto>>> QueueAsync(string parish, string? status, string? kind, int size, string? cursor, CancellationToken ct)
    {
        await OfficeAsync(parish, ct);
        var conditions = new List<RecordCondition>();
        if (status is not null) conditions.Add(Equal("status", Guard.Text(status, "Status", 40)));
        if (kind is not null) conditions.Add(Equal("kind", Guard.Text(kind, "Kind", 40)));
        return ProjectPage(await records.PageAsync<ParishRequest>(Scope(parish), "parishRequest", size, cursor, ct, [.. conditions]), true);
    }

    public async Task<IReadOnlyList<RequestHistoryDto>> HistoryAsync(string parish, string id, CancellationToken ct)
    {
        await OfficeAsync(parish, ct);
        await ReadAsync(parish, id, ct);
        var rows = await records.CollectAsync<RequestHistory>(Scope(parish), "requestChange", ct, 1000, Equal("requestId", id));
        return rows.Select(r => r.Value).OrderBy(h => h.At).ThenBy(h => h.Id, StringComparer.Ordinal).Select(h => new RequestHistoryDto
        {
            Id = h.Id, Action = h.Action, FromStatus = h.FromStatus, ToStatus = h.ToStatus, ActorAccountId = h.ActorAccountId, At = h.At,
            Previous = h.Previous is null ? null : Project(h.Previous, true)
        }).ToArray();
    }

    private async Task<ParishRequestDto> ApplicantActAsync(string parish, Versioned<ParishRequest> row, RequestActionDto request, string author, CancellationToken ct)
    {
        var op = Operation.Create(request.OperationId, author == "Guest" ? "guest:" + row.Value.Id : actor.AccountId, request, clock, "request-applicant:v1:" + row.Value.Id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, row.Value.Id, ct)).Value, false);
        var item = row.Value;
        var previous = Copy(item);
        var changes = new List<RecordChange>();
        switch (request.Action)
        {
            case "edit" when item.Status == "Received":
                // Only unhandled cases are edited directly; the previous version stays in history.
                item.Summary = Guard.Text(request.Summary ?? item.Summary, "Summary", 300);
                item.Details = Details(request.Details ?? item.Details);
                break;
            case "withdraw" when item.Status == "Received" || item.Status == "NeedsInformation" && item.ResumeStatus == "Received":
                item.Status = "Withdrawn";
                break;
            case "respond" when item.Status == "NeedsInformation":
                if (request.Details is not null)
                    item.Details = Details(request.Details);
                if (!string.IsNullOrWhiteSpace(request.Explanation))
                    changes.Add(MessageChange(item, "Applicant", author, author == "Guest" ? null : actor.AccountId, request.Explanation, op));
                item.Status = item.ResumeStatus ?? "Received";
                item.ResumeStatus = null;
                item.ApplicantExplanation = null;
                break;
            case "request-cancel" when item.Status == "AcceptedForProcessing":
                // Accepted work with dependencies is cancelled through the office, not unilaterally.
                if (!string.IsNullOrWhiteSpace(request.Explanation))
                    changes.Add(MessageChange(item, "Applicant", author, actor.AccountId, request.Explanation, op));
                item.Status = "CancellationRequested";
                break;
            default:
                throw State(request.Action is "edit" or "withdraw"
                    ? "This case is already being handled; send a message or request cancellation instead." : "This action is not available now.");
        }
        item.UpdatedAt = op.At;
        changes.Add(RecordChange.Replace(Key(item.Id), "parishRequest", item, Versions.Require(request.Version)));
        changes.Add(History(item, request.Action, previous.Status, previous, op, author == "Guest" ? null : actor.AccountId));
        await records.CommitAsync(Scope(parish), op, "request.applicant_" + request.Action.Replace('-', '_'), item.Id, changes,
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, false);
    }

    private async Task<RequestMessageDto> AddMessageAsync(string parish, ParishRequest item, PostRequestMessageDto request, string author, string? account, CancellationToken ct)
    {
        var op = Operation.Create(request.OperationId, account ?? "guest:" + item.Id, request, clock, "request-message:v1:" + item.Id);
        if (Terminal.Contains(item.Status) && author != "Office")
            throw State("This case is closed; contact the parish office.");
        var change = MessageChange(item, request.Audience, author, account, request.Body, op);
        await records.CommitAsync(Scope(parish), op, "request.message", item.Id, [change], new CommandResult { Id = op.Id, Status = "Posted" }, ct);
        var message = (RequestMessage)change.Value!;
        return new RequestMessageDto { Id = message.Id, Audience = message.Audience, AuthorKind = message.AuthorKind, AuthorAccountId = account, Body = message.Body, At = message.At };
    }

    private static RecordChange MessageChange(ParishRequest item, string audience, string author, string? account, string? body, Operation op)
        => RecordChange.Create("requestMessage:" + op.Id, "requestMessage", new RequestMessage
        {
            Id = op.Id, RequestId = item.Id, Audience = audience, AuthorKind = author, AuthorAccountId = account,
            Body = Guard.Text(body, "Message", 4000), At = op.At
        });

    internal async Task<Versioned<ParishRequest>> GuestCaseAsync(string parish, string id, string? token, CancellationToken ct)
    {
        await own.RootAsync(parish, ct);
        var row = await ReadAsync(parish, id, ct);
        // A leaked link is limited to this case; comparison is constant-time against the stored hash only.
        if (string.IsNullOrWhiteSpace(token) || row.Value.GuestTokenHash is not { } stored
            || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(stored), Encoding.ASCII.GetBytes(Hash(token))))
            throw Missing();
        return row;
    }

    private static ParishRequest NewCase(string parish, Operation op, string kind, string summary, Dictionary<string, string>? details, string? dates,
        string relationship, string? authority, string createdBy)
    {
        if (kind is not ("SacramentInquiry" or "Certificate" or "Facility" or "PriestAppointment" or "MassIntention" or "Blessing" or "Visit" or "MinistryInquiry" or "General")
            || relationship is not ("Self" or "Parent" or "Guardian" or "Spouse" or "Child" or "Relative" or "Representative" or "Other"))
            throw new DomainException("invalid_input", "Use a supported request kind and relationship.");
        var basis = string.IsNullOrWhiteSpace(authority) ? null : Guard.Text(authority, "Authority basis", 1000);
        if (relationship != "Self" && basis is null)
            throw new DomainException("invalid_input", "Explain your authority to make this request for someone else.");
        return new ParishRequest
        {
            NotificationWorkIds = [],
            Id = op.Id, Reference = "R-" + op.Id[..10].ToUpperInvariant(), ParishId = parish, Kind = kind, Summary = Guard.Text(summary, "Summary", 300),
            Details = Details(details), PreferredDates = string.IsNullOrWhiteSpace(dates) ? null : Guard.Text(dates, "Preferred dates", 500),
            Relationship = relationship, AuthorityBasis = basis, CreatedBy = createdBy, ReceivedAt = op.At, UpdatedAt = op.At
        };
    }

    private static Dictionary<string, string> Details(Dictionary<string, string>? details)
    {
        if (details is null || details.Count > 30 || details.Any(d => d.Key.Length is < 1 or > 60 || d.Key.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_')
            || d.Value is null || d.Value.Length > 2000))
            throw new DomainException("invalid_input", "Use up to 30 detail fields with short alphanumeric keys and values up to 2000 characters.");
        return new Dictionary<string, string>(details, StringComparer.Ordinal);
    }

    private async Task<string?> OwnPersonAsync(string parish, CancellationToken ct)
    {
        try { return (await own.OwnLinkAsync(parish, ct)).Value.PersonId; }
        catch (DomainException error) when (error.Kind == FailureKind.NotFound) { return null; }
    }

    private async Task<string> PersonAsync(string parish, string person, CancellationToken ct)
    {
        var row = (await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct))?.Value;
        if (row is null || row.ParishId != parish || row.Archived)
            throw Missing();
        return person;
    }

    private async Task<Versioned<ParishRequest>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<ParishRequest>(Scope(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static RecordChange History(ParishRequest item, string action, string from, ParishRequest? previous, Operation op, string? actorId)
        => RecordChange.Create("requestChange:" + op.Id, "requestChange", new RequestHistory
        {
            Id = op.Id, RequestId = item.Id, Action = action, FromStatus = from, ToStatus = item.Status,
            ActorAccountId = actorId, At = op.At, Previous = previous
        });

    private static ParishRequest Copy(ParishRequest x) => new()
    {
        Id = x.Id, Reference = x.Reference, ParishId = x.ParishId, Kind = x.Kind, Summary = x.Summary, Details = new(x.Details), PreferredDates = x.PreferredDates,
        Origin = x.Origin, ApplicantAccountId = x.ApplicantAccountId, ClaimantAccountId = x.ClaimantAccountId, RequesterName = x.RequesterName, RequesterContact = x.RequesterContact,
        SubjectPersonId = x.SubjectPersonId, SubjectDescription = x.SubjectDescription, Relationship = x.Relationship, AuthorityBasis = x.AuthorityBasis,
        AuthorityReviewed = x.AuthorityReviewed, Status = x.Status, ResumeStatus = x.ResumeStatus, ApplicantExplanation = x.ApplicantExplanation,
        AcceptedAt = x.AcceptedAt, ClergyApprovedBy = x.ClergyApprovedBy, ClergyApprovedAt = x.ClergyApprovedAt, ConfirmedDate = x.ConfirmedDate,
        CompletedAt = x.CompletedAt, Urgency = x.Urgency, UrgencyReason = x.UrgencyReason, AssignedTo = x.AssignedTo, Deadline = x.Deadline,
        NextAction = x.NextAction, Checklist = [.. x.Checklist], Links = [.. x.Links], CreatedBy = x.CreatedBy, ReceivedAt = x.ReceivedAt, UpdatedAt = x.UpdatedAt
    };

    private Page<Versioned<ParishRequestDto>> ProjectPage(Page<Versioned<ParishRequest>> page, bool office) => new()
    {
        Items = page.Items.Select(r => new Versioned<ParishRequestDto> { Version = r.Version, Value = Project(r.Value, office) }).ToArray(),
        ContinuationToken = page.ContinuationToken
    };

    // Distinct, fact-based meanings: receipt is not acceptance, acceptance is not clergy approval, and approval is not a confirmed date.
    private static string Meaning(ParishRequest x) => x.Status switch
    {
        "Received" => "Received: saved for review; nothing has been accepted or scheduled yet.",
        "NeedsInformation" => "Needs information: the parish asked for more details; the case is not declined.",
        "AcceptedForProcessing" => "Accepted for processing" + (x.ClergyApprovedAt is null ? "" : "; approved by priest")
            + (x.ConfirmedDate is null ? "; no date is confirmed yet." : "; date confirmed."),
        "CancellationRequested" => "Cancellation requested: waiting for the parish to review it.",
        "Completed" => "Completed.",
        "Declined" => "Declined by the parish.",
        "Withdrawn" => "Withdrawn by the applicant.",
        _ => "Cancelled."
    };

    private ParishRequestDto Project(ParishRequest x, bool office)
    {
        var now = clock.GetUtcNow();
        return new ParishRequestDto
        {
            Id = x.Id, Reference = x.Reference, Kind = x.Kind, Summary = x.Summary, Details = new(x.Details), PreferredDates = x.PreferredDates, Origin = x.Origin,
            ApplicantAccountId = office ? x.ApplicantAccountId : null, ClaimantAccountId = office ? x.ClaimantAccountId : null, RequesterName = x.RequesterName, RequesterContact = x.RequesterContact,
            SubjectPersonId = office ? x.SubjectPersonId : null, SubjectDescription = x.SubjectDescription, Relationship = x.Relationship,
            AuthorityBasis = office ? x.AuthorityBasis : null, AuthorityReviewed = x.AuthorityReviewed, Status = x.Status, StatusMeaning = Meaning(x),
            AcceptedAt = x.AcceptedAt, ClergyApprovedAt = x.ClergyApprovedAt, ConfirmedDate = x.ConfirmedDate, CompletedAt = x.CompletedAt,
            ApplicantExplanation = x.ApplicantExplanation, Urgency = office ? x.Urgency : null, UrgencyReason = office ? x.UrgencyReason : null,
            AssignedTo = office ? x.AssignedTo : null, Deadline = office ? x.Deadline : null, NextAction = office ? x.NextAction : null,
            Overdue = office && x.Deadline < now && !Terminal.Contains(x.Status),
            Checklist = x.Checklist.Select(c => new ChecklistItemDto
            {
                Key = c.Key, Label = c.Label, Required = c.Required, Status = c.Status, PaperReference = office ? c.PaperReference : null,
                VerifiedBy = office ? c.VerifiedBy : null, VerifiedAt = c.VerifiedAt
            }).ToArray(),
            Links = [.. x.Links], CreatedBy = office ? x.CreatedBy : null, ReceivedAt = x.ReceivedAt, UpdatedAt = x.UpdatedAt
        };
    }

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
