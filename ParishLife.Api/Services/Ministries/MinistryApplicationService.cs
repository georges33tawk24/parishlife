// Purpose: coordinates evidenced ministry applications, independent review, confidential departure and effective membership.
// Main functions: ApplyAsync, ActAsync, GetAsync, ListAsync, OwnAsync, HistoryAsync, EvidenceAsync, RosterAsync and OwnMembershipAsync;
// helpers reauthorize every request and commit the application, roster, history and conditional authority fences together.

using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public class MinistryApplicationService(IRecordTransactions records, MinistryAccess access, IParishAccess parishAccess,
    ICurrentActor actor, IDataProtectionProvider protection, TimeProvider clock)
{
    public async Task<MinistryApplicationDto> ApplyAsync(string parish, string ministry, ApplyMinistryDto request, CancellationToken ct)
    {
        var scope = MinistryAccess.Scope(parish);
        var root = await access.RootAsync(parish, ct);
        var group = await access.ReadAsync(parish, ministry, ct);
        if (request.Kind is not ("Join" or "Leave"))
            throw MinistryAccess.State("Choose Join or Leave.");
        Versioned<PersonAccountLink>? link = null;
        string personId;
        if (request.PersonId is { } target)
        {
            if (request.Kind != "Join")
                throw MinistryAccess.Missing();
            await RequirePreparerAsync(parish, ministry, ct);
            personId = Guard.Id(target);
            Guard.Text(request.RepresentationEvidence, "Actual applicant instruction or representation evidence", 1000);
        }
        else
        {
            await access.PersonalAsync(ct);
            link = await access.OwnLinkAsync(parish, ct);
            personId = link.Value.PersonId;
        }
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-application:v2:" + ministry);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } replay)
            return (await GetAsync(parish, ministry, replay.Id, ct)).Value;
        if (request.Kind == "Join")
        {
            await access.ModuleAsync(parish, ct);
            if (group.Value.Status != "Active" || !group.Value.ApplicationsOpen)
                throw MinistryAccess.State("This ministry is not accepting new applications.");
        }
        else if (group.Value.Status is not ("Active" or "Archived"))
            throw MinistryAccess.State("Departure requires an existing active or archived ministry.");
        var person = await RequirePersonAsync(parish, personId, ct);
        var membership = await records.ReadAsync<MinistryMembership>(scope, MinistryAccess.MemberKey(ministry, personId), ct);
        if (request.Kind == "Join" && membership?.Value.Current(op.At) == true
            || request.Kind == "Leave" && membership?.Value.Current(op.At) != true)
            throw MinistryAccess.State("The request does not match the person's current membership.");
        var guardKey = GuardKey(ministry, personId);
        var pending = await records.ReadAsync<CommandResult>(scope, guardKey, ct);
        if (pending?.Value.Status == "Pending")
            throw MinistryAccess.State("Resolve the existing membership application first.");
        var item = new MinistryApplication
        {
            Id = op.Id, MinistryId = ministry, PersonId = personId, ApplicantAccountId = link?.Value.AccountId,
            Kind = request.Kind, Status = request.Kind == "Join" ? "Submitted" : "AwaitingPriest",
            SubmittedBy = actor.AccountId, SubmittedAt = op.At, PolicyRevision = group.Value.PolicyRevision,
            ProtectedRepresentationEvidence = request.PersonId is null ? null : Protect(parish, op.Id, "representation", request.RepresentationEvidence)
        };
        var changes = new List<RecordChange>
        {
            MinistryAccess.Fence(root), GroupFence(group), PersonFence(person),
            RecordChange.Create(Key(item.Id), "ministryApplication", item),
            pending is null ? RecordChange.Create(guardKey, "ministryApplicationGuard", new CommandResult { Id = item.Id, Status = "Pending" })
                : RecordChange.Replace(guardKey, "ministryApplicationGuard", new CommandResult { Id = item.Id, Status = "Pending" }, pending.Version),
            History(item, null, "submit", op)
        };
        if (link is not null)
            changes.Add(LinkFence(link));
        await records.CommitAsync(scope, op, "ministry.application_submit", item.Id, changes, Result(item), ct);
        return (await GetAsync(parish, ministry, item.Id, ct)).Value;
    }

    public async Task<Versioned<MinistryApplicationDto>> GetAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var row = await ReadAuthorizedAsync(parish, ministry, id, ct);
        return new() { Version = row.Version, Value = View(parish, row.Value) };
    }

    internal async Task<Versioned<MinistryApplication>> ReadAuthorizedAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        await access.RootAsync(parish, ct);
        await access.ReadAsync(parish, ministry, ct);
        var row = await records.ReadAsync<MinistryApplication>(MinistryAccess.Scope(parish), Key(id), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != id || row.Value.MinistryId != ministry)
            throw MinistryAccess.Missing();
        if (row.Value.ApplicantAccountId == actor.AccountId && actor.ActingAppointmentId is null)
            await access.PersonalAsync(ct);
        else if (row.Value.Kind == "Leave")
            await access.PriestAsync(parish, ct, requireModule: false);
        else if (row.Value.SubmittedBy == actor.AccountId && row.Value.ApplicantAccountId is null)
            await RequirePreparerAsync(parish, ministry, ct);
        else
            await access.LeaderAsync(parish, ministry, ct, requireModule: false);
        return row;
    }

    public async Task<Page<Versioned<MinistryApplicationDto>>> ListAsync(string parish, string ministry, string kind, int size, string? cursor, CancellationToken ct)
    {
        await access.RootAsync(parish, ct);
        if (kind == "Leave")
            await access.PriestAsync(parish, ct, requireModule: false);
        else if (kind == "Join")
            await access.LeaderAsync(parish, ministry, ct, requireModule: false);
        else
            throw MinistryAccess.State("Choose Join or Leave; departure requests have a separate priest-only queue.");
        await access.ReadAsync(parish, ministry, ct);
        var page = await records.PageAsync<MinistryApplication>(MinistryAccess.Scope(parish), "ministryApplication", size, cursor, ct,
            Equal("ministryId", ministry), Equal("kind", kind));
        return ProjectPage(parish, page);
    }

    public async Task<Page<Versioned<MinistryApplicationDto>>> OwnAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        await access.PersonalAsync(ct);
        await access.RootAsync(parish, ct);
        await access.ReadAsync(parish, ministry, ct);
        var page = await records.PageAsync<MinistryApplication>(MinistryAccess.Scope(parish), "ministryApplication", size, cursor, ct,
            Equal("ministryId", ministry), Equal("applicantAccountId", actor.AccountId));
        return ProjectPage(parish, page);
    }

    public async Task<MinistryApplicationDto> ActAsync(string parish, string ministry, string id, ApplicationActionDto request, CancellationToken ct)
    {
        var root = await access.RootAsync(parish, ct);
        var row = await ReadAuthorizedAsync(parish, ministry, id, ct);
        var item = row.Value;
        // Authority is checked before replay; an old receipt never restores a revoked role.
        switch (request.Action)
        {
            case "withdraw":
                await RequireApplicantAsync(item, ct);
                break;
            case "resubmit":
                if (item.ApplicantAccountId == actor.AccountId)
                    await RequireApplicantAsync(item, ct);
                else if (item.ApplicantAccountId is null && item.SubmittedBy == actor.AccountId)
                    await RequirePreparerAsync(parish, ministry, ct);
                else throw MinistryAccess.Missing();
                break;
            case "recommend":
                await access.LeaderAsync(parish, ministry, ct, requireModule: false);
                RequireIndependent(item);
                break;
            case "return":
                if (item.Status == "AwaitingPriest" || item.Status == "Returned" && item.ReturnResumeStatus == "AwaitingPriest")
                    await access.PriestAsync(parish, ct, requireModule: false);
                else await access.LeaderAsync(parish, ministry, ct, requireModule: false);
                RequireIndependent(item);
                break;
            case "approve":
            case "decline":
            case "approve-withdrawal":
            case "deny-withdrawal":
                await access.PriestAsync(parish, ct, requireModule: false);
                RequireIndependent(item);
                break;
            default:
                throw MinistryAccess.State("Unsupported application action.");
        }
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-application-action:v2:" + ministry + ":" + id);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return (await GetAsync(parish, ministry, id, ct)).Value;
        if (Terminal(item.Status))
            throw MinistryAccess.State("The application has already ended; its history cannot be overwritten.");
        var group = await access.ReadAsync(parish, ministry, ct);
        var previous = item.Status;
        var changes = new List<RecordChange> { MinistryAccess.Fence(root), GroupFence(group) };
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Applicant-visible reason", 2000);
        switch (request.Action)
        {
            case "withdraw":
                if (item.Status == "WithdrawalRequested")
                    throw MinistryAccess.State("A withdrawal decision is already pending.");
                if (item.Kind == "Join" && item.Status is "Submitted" or "Returned" && item.RecommendedAt is null)
                {
                    item.Status = "Withdrawn";
                    item.DecidedAt = op.At;
                    item.DecidedBy = actor.AccountId;
                }
                else
                {
                    item.PriorStatus = item.Status;
                    item.Status = "WithdrawalRequested";
                }
                break;
            case "resubmit":
                await access.ModuleAsync(parish, ct);
                if (item.Kind != "Join" || item.Status != "Returned" || group.Value.Status != "Active")
                    throw MinistryAccess.State("Only a returned join application in an active ministry can be resubmitted.");
                await FenceApplicantAsync(parish, item, changes, ct);
                item.Status = item.ReturnResumeStatus == "AwaitingPriest" && item.PolicyRevision == group.Value.PolicyRevision ? "AwaitingPriest" : "Submitted";
                item.ReturnResumeStatus = null;
                item.PolicyRevision = group.Value.PolicyRevision;
                break;
            case "recommend":
                if (item.Kind != "Join" || item.Status != "Submitted" || group.Value.Status != "Active")
                    throw MinistryAccess.State("Review a submitted join application in an active ministry.");
                item.Status = "AwaitingPriest";
                item.ReviewedBy = actor.AccountId;
                item.ReviewedAt = op.At;
                item.RecommendedAt = op.At;
                break;
            case "return":
                if (item.Kind != "Join" || item.Status is not ("Submitted" or "AwaitingPriest") || group.Value.Status != "Active")
                    throw MinistryAccess.State("Return an active ministry's submitted or priest-review request for specified information.");
                reason = Guard.Text(request.Reason, "Applicant-visible return reason", 2000);
                item.ReturnResumeStatus = item.Status;
                item.Status = "Returned";
                item.ReviewedBy = actor.AccountId;
                item.ReviewedAt = op.At;
                break;
            case "approve-withdrawal":
            case "deny-withdrawal":
                if (item.Status != "WithdrawalRequested" || item.PriorStatus is not ("Submitted" or "Returned" or "AwaitingPriest"))
                    throw MinistryAccess.State("There is no valid pending withdrawal request.");
                if (request.Action == "deny-withdrawal")
                    reason = Guard.Text(request.Reason, "Applicant-visible withdrawal decision reason", 2000);
                item.Status = request.Action == "approve-withdrawal" ? "Withdrawn" : item.PriorStatus;
                item.PriorStatus = null;
                if (item.Status == "Withdrawn") { item.DecidedAt = op.At; item.DecidedBy = actor.AccountId; }
                break;
            case "approve":
            case "decline":
                if (item.Status is not ("Submitted" or "Returned" or "AwaitingPriest")
                    || item.Kind == "Leave" && item.Status != "AwaitingPriest")
                    throw MinistryAccess.State("Resolve the pending withdrawal before a final membership decision.");
                if (request.Action == "decline")
                    reason = Guard.Text(request.Reason, "Applicant-visible decision reason", 2000);
                else
                {
                    if (item.Kind == "Join")
                    {
                        if (group.Value.Status != "Active" || item.PolicyRevision != group.Value.PolicyRevision)
                            throw MinistryAccess.State("The application needs review against the current active ministry policy.");
                        item.ProtectedEligibilityReviewReference = Protect(parish, id, "eligibility",
                            Guard.Text(request.EligibilityReviewReference, "Actual eligibility and consent review reference", 1000));
                    }
                    await FenceApplicantAsync(parish, item, changes, ct);
                    await ChangeMembershipAsync(parish, item, op, changes, ct);
                }
                item.Status = request.Action == "approve" ? "Approved" : "Declined";
                item.DecidedBy = actor.AccountId;
                item.DecidedAt = op.At;
                break;
        }
        item.ProtectedReason = Protect(parish, id, "reason", reason);
        var guardKey = GuardKey(ministry, item.PersonId);
        var pending = await records.ReadAsync<CommandResult>(scope, guardKey, ct) ?? throw MinistryAccess.Missing();
        if (pending.Value.Id != id || pending.Value.Status != "Pending")
            throw MinistryAccess.State("The application's pending guard must be reviewed before this change.");
        if (Terminal(item.Status))
            changes.Add(RecordChange.Replace(guardKey, "ministryApplicationGuard", new CommandResult { Id = id, Status = "Ended" }, pending.Version));
        changes.Add(RecordChange.Replace(Key(id), "ministryApplication", item, Versions.Require(request.Version)));
        changes.Add(History(item, previous, request.Action, op));
        await records.CommitAsync(scope, op, "ministry.application_" + request.Action, id, changes, Result(item), ct);
        return (await GetAsync(parish, ministry, id, ct)).Value;
    }

    public async Task<Page<MinistryApplicationHistoryDto>> HistoryAsync(string parish, string ministry, string id, int size, string? cursor, CancellationToken ct)
    {
        await ReadAuthorizedAsync(parish, ministry, id, ct);
        var page = await records.PageAsync<MinistryApplicationHistory>(MinistryAccess.Scope(parish), "ministryApplicationHistory", size, cursor, ct,
            Equal("ministryId", ministry), Equal("applicationId", id));
        return new()
        {
            Items = page.Items.Select(row => new MinistryApplicationHistoryDto
            {
                Id = row.Value.Id, ApplicationId = row.Value.ApplicationId, Action = row.Value.Action,
                PreviousStatus = row.Value.PreviousStatus, Status = row.Value.Status, RecordedAt = row.Value.RecordedAt,
                Reason = Unprotect(parish, id, "reason", row.Value.ProtectedReason)
            }).ToArray(), ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<MinistryApplicationEvidenceDto> EvidenceAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        await access.PriestAsync(parish, ct, requireModule: false);
        var item = (await ReadAuthorizedAsync(parish, ministry, id, ct)).Value;
        return new()
        {
            ApplicationId = id, PreparedBy = item.SubmittedBy, ApplicantAccountId = item.ApplicantAccountId,
            ReviewedBy = item.ReviewedBy, DecidedBy = item.DecidedBy, PolicyRevision = item.PolicyRevision,
            RepresentationEvidence = Unprotect(parish, id, "representation", item.ProtectedRepresentationEvidence),
            EligibilityReviewReference = Unprotect(parish, id, "eligibility", item.ProtectedEligibilityReviewReference)
        };
    }

    public async Task<Page<MinistryMembershipDto>> RosterAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        await access.ReaderAsync(parish, ministry, ct);
        var page = await records.PageAsync<MinistryMembership>(MinistryAccess.Scope(parish), "ministryMembership", size, cursor, ct, Equal("ministryId", ministry));
        return new() { Items = page.Items.Select(row => MemberView(row.Value)).ToArray(), ContinuationToken = page.ContinuationToken };
    }

    public async Task<MinistryMembershipDto> OwnMembershipAsync(string parish, string ministry, CancellationToken ct)
    {
        await access.PersonalAsync(ct);
        await access.RootAsync(parish, ct);
        await access.ReadAsync(parish, ministry, ct);
        var link = await access.OwnLinkAsync(parish, ct);
        var row = await records.ReadAsync<MinistryMembership>(MinistryAccess.Scope(parish), MinistryAccess.MemberKey(ministry, link.Value.PersonId), ct)
            ?? throw MinistryAccess.Missing();
        return MemberView(row.Value);
    }

    private async Task RequirePreparerAsync(string parish, string ministry, CancellationToken ct)
    {
        // A leader's group scope is not permission to browse or link arbitrary parish people.
        await access.ReaderAsync(parish, ministry, ct);
        await parishAccess.RequireAsync(parish, Permissions.PeopleWrite, ct);
    }

    private async Task RequireApplicantAsync(MinistryApplication item, CancellationToken ct)
    {
        await access.PersonalAsync(ct);
        if (item.ApplicantAccountId != actor.AccountId) throw MinistryAccess.Missing();
    }

    private void RequireIndependent(MinistryApplication item)
    {
        if (item.ApplicantAccountId == actor.AccountId || item.SubmittedBy == actor.AccountId)
            throw MinistryAccess.State("A different eligible reviewer must decide this application.");
    }

    private async Task<Versioned<Person>> RequirePersonAsync(string parish, string personId, CancellationToken ct)
    {
        var row = await records.ReadAsync<Person>(MinistryAccess.Scope(parish), "person:" + personId, ct);
        return row?.Value is { Archived: false } && row.Value.Id == personId && row.Value.ParishId == parish ? row : throw MinistryAccess.Missing();
    }

    private async Task FenceApplicantAsync(string parish, MinistryApplication item, List<RecordChange> changes, CancellationToken ct)
    {
        if (item.Kind == "Leave")
        {
            var person = await records.ReadAsync<Person>(MinistryAccess.Scope(parish), "person:" + item.PersonId, ct);
            if (person is null || person.Value.Id != item.PersonId || person.Value.ParishId != parish || item.ApplicantAccountId is null)
                throw MinistryAccess.Missing();
            changes.Add(PersonFence(person));
            return;
        }
        changes.Add(PersonFence(await RequirePersonAsync(parish, item.PersonId, ct)));
        if (item.ApplicantAccountId is not { } account)
        {
            if (item.Kind != "Join" || string.IsNullOrEmpty(item.ProtectedRepresentationEvidence))
                throw MinistryAccess.State("This assisted application needs reviewed applicant provenance.");
            return;
        }
        var scope = MinistryAccess.Scope(parish);
        var link = await records.ReadAsync<PersonAccountLink>(scope, "personAccountLink:" + account, ct);
        var claim = await records.ReadAsync<CommandResult>(scope, "personAccountClaim:" + item.PersonId, ct);
        if (link?.Value is not { Active: true } || link.Value.AccountId != account || link.Value.ParishId != parish
            || link.Value.PersonId != item.PersonId || claim?.Value.Id != account || claim.Value.Status != "Linked")
            throw MinistryAccess.State("The current reviewed account/person link must be resolved before approval.");
        changes.Add(LinkFence(link));
        changes.Add(RecordChange.Replace("personAccountClaim:" + item.PersonId, "personAccountClaim", claim.Value, claim.Version));
    }

    private async Task ChangeMembershipAsync(string parish, MinistryApplication item, Operation op, List<RecordChange> changes, CancellationToken ct)
    {
        var scope = MinistryAccess.Scope(parish);
        var key = MinistryAccess.MemberKey(item.MinistryId, item.PersonId);
        var previous = await records.ReadAsync<MinistryMembership>(scope, key, ct);
        MinistryMembership value;
        if (item.Kind == "Join")
        {
            if (previous?.Value.Current(op.At) == true) throw MinistryAccess.State("The person is already an active member.");
            if (previous is not null)
            {
                var oldPeriod = string.IsNullOrEmpty(previous.Value.PeriodId) ? null : await records.ReadAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod:" + previous.Value.PeriodId, ct);
                if (oldPeriod is null || oldPeriod.Value.MinistryId != item.MinistryId || oldPeriod.Value.PersonId != item.PersonId
                    || oldPeriod.Value.JoinedAt != previous.Value.JoinedAt || oldPeriod.Value.LeftAt != previous.Value.LeftAt || oldPeriod.Value.LeftAt is null)
                    throw MinistryAccess.State("Review the prior membership interval before rejoining; previous history cannot be silently replaced.");
            }
            value = new() { Id = item.PersonId, MinistryId = item.MinistryId, PersonId = item.PersonId, JoinedAt = op.At,
                ApprovedBy = actor.AccountId, ApplicationId = item.Id, PeriodId = item.Id };
            changes.Add(RecordChange.Create("ministryMembershipPeriod:" + value.PeriodId, "ministryMembershipPeriod", new MinistryMembershipPeriod
            {
                Id = value.PeriodId, MinistryId = item.MinistryId, PersonId = item.PersonId, JoinedAt = op.At,
                JoinApplicationId = item.Id, ApprovedBy = actor.AccountId
            }));
        }
        else
        {
            if (previous?.Value.Current(op.At) != true) throw MinistryAccess.State("There is no current membership to end.");
            value = previous.Value;
            var period = string.IsNullOrEmpty(value.PeriodId) ? null : await records.ReadAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod:" + value.PeriodId, ct);
            if (period is null || period.Value.MinistryId != item.MinistryId || period.Value.PersonId != item.PersonId
                || period.Value.JoinedAt != value.JoinedAt || period.Value.LeftAt is not null)
                throw MinistryAccess.State("Review the recorded membership interval before ending this legacy or inconsistent membership.");
            period.Value.LeftAt = op.At;
            period.Value.LeaveApplicationId = item.Id;
            period.Value.EndedBy = actor.AccountId;
            changes.Add(RecordChange.Replace("ministryMembershipPeriod:" + period.Value.Id, "ministryMembershipPeriod", period.Value, period.Version));
            value.LeftAt = op.At;
            value.ApprovedBy = actor.AccountId;
            value.ApplicationId = item.Id;
            // Resolve the actual reviewed claim, not only the original application's account field.
            var claim = await records.ReadAsync<CommandResult>(scope, "personAccountClaim:" + item.PersonId, ct);
            var accountIds = new[] { item.ApplicantAccountId, claim?.Value.Status == "Linked" ? claim.Value.Id : null }
                .Where(account => account is not null).Select(account => account!).Distinct(StringComparer.Ordinal);
            foreach (var linkedAccount in accountIds)
            {
                var leaderKey = "ministryLeader:" + item.MinistryId + ":" + linkedAccount;
                var leader = await records.ReadAsync<MinistryLeader>(scope, leaderKey, ct);
                if (leader is not null && !leader.Value.Revoked && leader.Value.EndedAt is null)
                {
                    leader.Value.Revoked = true;
                    if (leader.Value.StartsAt <= op.At && (leader.Value.EndsAt is null || leader.Value.EndsAt > op.At))
                        leader.Value.EndsAt = op.At;
                    leader.Value.EndedAt = op.At;
                    leader.Value.EndedBy = actor.AccountId;
                    leader.Value.EndReason = null;
                    changes.Add(RecordChange.Replace(leaderKey, "ministryLeader", leader.Value, leader.Version));
                    changes.Add(RecordChange.Create("ministryLeadershipChange:" + op.Id + ":end:" + linkedAccount, "ministryLeadershipChange", new MinistryLeadershipHistory
                    {
                        Id = op.Id + ":end:" + linkedAccount, MinistryId = item.MinistryId, AccountId = linkedAccount, Action = "Ended",
                        RecordedBy = actor.AccountId, RecordedAt = op.At, Appointment = leader.Value
                    }));
                }
            }
        }
        changes.Add(previous is null ? RecordChange.Create(key, "ministryMembership", value) : RecordChange.Replace(key, "ministryMembership", value, previous.Version));
        changes.Add(RecordChange.Create("ministryMembershipHistory:" + op.Id, "ministryMembershipHistory", value));
    }

    private MinistryApplicationDto View(string parish, MinistryApplication value) => new()
    {
        Id = value.Id, MinistryId = value.MinistryId, PersonId = value.PersonId, Kind = value.Kind, Status = value.Status,
        SubmittedAt = value.SubmittedAt, ReviewedAt = value.ReviewedAt, RecommendedAt = value.RecommendedAt, DecidedAt = value.DecidedAt,
        NextOwner = value.Status switch { "Submitted" => "LeaderOrPriest", "Returned" => "ApplicantOrPreparer", "AwaitingPriest" or "WithdrawalRequested" => "Priest", _ => "None" },
        Reason = Unprotect(parish, value.Id, "reason", value.ProtectedReason)
    };

    private Page<Versioned<MinistryApplicationDto>> ProjectPage(string parish, Page<Versioned<MinistryApplication>> page) => new()
    {
        Items = page.Items.Select(row => new Versioned<MinistryApplicationDto> { Version = row.Version, Value = View(parish, row.Value) }).ToArray(),
        ContinuationToken = page.ContinuationToken
    };

    private MinistryMembershipDto MemberView(MinistryMembership value) => new()
    {
        MinistryId = value.MinistryId, PersonId = value.PersonId, JoinedAt = value.JoinedAt, LeftAt = value.LeftAt, Current = value.Current(clock.GetUtcNow())
    };

    private static RecordChange History(MinistryApplication item, string? previous, string action, Operation op) => RecordChange.Create(
        "ministryApplicationHistory:" + op.Id, "ministryApplicationHistory", new MinistryApplicationHistory
        {
            Id = op.Id, MinistryId = item.MinistryId, ApplicationId = item.Id, Action = action, PreviousStatus = previous, Status = item.Status,
            ActorId = op.ActorId, ActingAppointmentId = op.ActingAppointmentId, RecordedAt = op.At,
            ProtectedReason = item.ProtectedReason, ProtectedEligibilityReviewReference = item.ProtectedEligibilityReviewReference
        });

    private IDataProtector Protector(string parish, string id, string field) => protection.CreateProtector("ParishLife.MinistryApplication.v1", parish, id, field);
    private string? Protect(string parish, string id, string field, string? value) => value is null ? null : Protector(parish, id, field).Protect(value.Trim());
    private string? Unprotect(string parish, string id, string field, string? value)
    {
        if (value is null) return null;
        try { return Protector(parish, id, field).Unprotect(value); }
        catch (CryptographicException) { throw new DomainException("protected_record_unavailable", "The protected ministry record could not be read.", FailureKind.Unavailable); }
    }
    private static string Key(string id) => "ministryApplication:" + id;
    private static string GuardKey(string ministry, string person) => "ministryApplicationGuard:" + ministry + ":" + person;
    private static bool Terminal(string status) => status is "Approved" or "Declined" or "Withdrawn";
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static CommandResult Result(MinistryApplication item) => new() { Id = item.Id, Status = item.Status };
    private static RecordChange GroupFence(Versioned<Ministry> group) => RecordChange.Replace("ministry:" + group.Value.Id, "ministry", group.Value, group.Version);
    private static RecordChange PersonFence(Versioned<Person> person) => RecordChange.Replace("person:" + person.Value.Id, "person", person.Value, person.Version);
    private static RecordChange LinkFence(Versioned<PersonAccountLink> link) => RecordChange.Replace("personAccountLink:" + link.Value.AccountId, "personAccountLink", link.Value, link.Version);
}
