// Purpose: manages ministry volunteer opportunities, invitations/signups, coordinator confirmation, cancellations and independently reviewed hours.
// Main functions: CreateOpportunityAsync, OpportunityActionAsync, ListOpportunitiesAsync, OpenOpportunitiesAsync, InviteAsync, ActAsync,
// TeamAsync, OwnAssignmentsAsync, SubmitHoursAsync, HoursActionAsync, HoursAsync and OwnHoursAsync; helpers enforce the coordinator duty,
// current membership, capacity and overlap checks. A volunteer is a person with an assignment, never a separate account role.
// Every write fences the parish root, so capacity and overlapping-duty checks cannot be raced by concurrent confirmations.

using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public class MinistryVolunteerService(IRecordTransactions records, MinistryAccess access, ICurrentActor actor, TimeProvider clock)
{
    private static string OpportunityKey(string id) => "volunteerOpportunity:" + id;
    private static string AssignmentKey(string id) => "volunteerAssignment:" + id;
    private static string HoursKey(string assignment) => "volunteerHours:" + assignment;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException State(string message) => new("invalid_volunteer_state", message, FailureKind.Conflict);

    // One assignment per person and opportunity, shared by invitations and signups.
    private static string AssignmentId(string opportunity, string person)
        => new Guid(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(opportunity + ":" + person)).AsSpan(0, 16)).ToString("N");

    public async Task<VolunteerOpportunityDto> CreateOpportunityAsync(string parish, string ministry, SaveOpportunityDto request, CancellationToken ct)
    {
        var group = await access.RequireCoordinatorAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "volunteer-opportunity:v1:" + ministry);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } prior)
            return Project((await ReadOpportunityAsync(parish, ministry, prior.Id, ct)).Value);
        if (group.Value.Status != "Active")
            throw State("Volunteer opportunities belong to an active ministry.");
        if (Guard.Utc(request.StartsAt) <= op.At || Guard.Utc(request.EndsAt) <= request.StartsAt || request.Capacity is < 1 or > 500)
            throw new DomainException("invalid_input", "Use a future UTC start, a later end and a capacity of 1–500.");
        var item = new VolunteerOpportunity
        {
            Id = op.Id, ParishId = parish, MinistryId = ministry, Title = Guard.Text(request.Title, "Title", 300),
            Position = Guard.Text(request.Position, "Position", 200),
            Requirements = string.IsNullOrWhiteSpace(request.Requirements) ? null : Guard.Text(request.Requirements, "Requirements", 2000),
            Location = string.IsNullOrWhiteSpace(request.Location) ? null : Guard.Text(request.Location, "Location", 300),
            StartsAt = request.StartsAt, EndsAt = request.EndsAt, Capacity = request.Capacity, SelfSignup = request.SelfSignup,
            CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        await records.CommitAsync(scope, op, "ministry.volunteer_opportunity_create", ministry,
            [MinistryAccess.Fence(root), RecordChange.Create(OpportunityKey(item.Id), "volunteerOpportunity", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<VolunteerOpportunityDto> OpportunityActionAsync(string parish, string ministry, string opportunity, OpportunityActionDto request, CancellationToken ct)
    {
        await access.RequireCoordinatorAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "volunteer-opportunity-action:v1:" + opportunity);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return Project((await ReadOpportunityAsync(parish, ministry, opportunity, ct)).Value);
        var item = (await ReadOpportunityAsync(parish, ministry, opportunity, ct)).Value;
        switch (request.Action)
        {
            case "open" when item.Status == "Draft" && item.StartsAt > op.At:
                item.Status = "Open";
                break;
            case "close" when item.Status == "Open":
                item.Status = "Closed";
                break;
            case "cancel" when item.Status is "Draft" or "Open" or "Closed":
                // Confirmed people are told and released individually first; the slot is never silently emptied.
                if (item.Confirmed > 0)
                    throw State("Cancel each confirmed commitment before cancelling the opportunity.");
                Guard.Text(request.Reason, "Cancellation reason", 2000);
                item.Status = "Cancelled";
                break;
            default:
                throw State("This opportunity action is not available in its current state.");
        }
        await records.CommitAsync(scope, op, "ministry.volunteer_opportunity_" + request.Action, ministry,
            [MinistryAccess.Fence(root), RecordChange.Replace(OpportunityKey(item.Id), "volunteerOpportunity", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<Page<Versioned<VolunteerOpportunityDto>>> ListOpportunitiesAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireCoordinatorAsync(parish, ministry, ct, readOnly: true);
        return OpportunityPage(await records.PageAsync<VolunteerOpportunity>(MinistryAccess.Scope(parish), "volunteerOpportunity", size, cursor, ct,
            Equal("ministryId", ministry)));
    }

    // The member signup sheet shows requirements and remaining places, never other volunteers' identities.
    public async Task<Page<Versioned<VolunteerOpportunityDto>>> OpenOpportunitiesAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        var link = await access.OwnLinkAsync(parish, ct);
        if (!await access.IsCurrentMemberAsync(parish, ministry, link.Value.PersonId, clock.GetUtcNow(), ct))
            throw MinistryAccess.Missing();
        return OpportunityPage(await records.PageAsync<VolunteerOpportunity>(MinistryAccess.Scope(parish), "volunteerOpportunity", size, cursor, ct,
            Equal("ministryId", ministry), Equal("status", "Open")));
    }

    public async Task<VolunteerAssignmentDto> InviteAsync(string parish, string ministry, string opportunity, InviteVolunteerDto request, CancellationToken ct)
    {
        var signup = request.PersonId is null;
        var person = signup ? (await access.OwnLinkAsync(parish, ct)).Value.PersonId : Guard.Id(request.PersonId!.Value);
        if (!signup)
            await access.RequireCoordinatorAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "volunteer-assignment:v1:" + opportunity);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } prior)
            return await CurrentAsync(parish, ministry, prior.Id, !signup, ct);
        var slot = (await ReadOpportunityAsync(parish, ministry, opportunity, ct)).Value;
        if (slot.Status != "Open" || slot.StartsAt <= op.At || signup && !slot.SelfSignup)
            throw State(signup ? "This opportunity is not open for signup." : "Invitations need an open future opportunity.");
        if (!await access.IsCurrentMemberAsync(parish, ministry, person, op.At, ct))
            throw State("Volunteering here is limited to current, unarchived ministry members.");
        var id = AssignmentId(opportunity, person);
        if (await records.ReadAsync<VolunteerAssignment>(scope, AssignmentKey(id), ct) is not null)
            throw State("This person already has an assignment record for this opportunity.");
        var item = new VolunteerAssignment
        {
            Id = id, ParishId = parish, MinistryId = ministry, OpportunityId = opportunity, PersonId = person,
            StartsAt = slot.StartsAt, EndsAt = slot.EndsAt, Origin = signup ? "Signup" : "Invitation",
            Status = signup ? "AwaitingConfirmation" : "Invited", NextActor = signup ? "Coordinator" : "Volunteer",
            CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        await records.CommitAsync(scope, op, "ministry.volunteer_" + (signup ? "signup" : "invite"), ministry,
            [MinistryAccess.Fence(root), RecordChange.Create(AssignmentKey(id), "volunteerAssignment", item)],
            new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item, !signup);
    }

    public async Task<VolunteerAssignmentDto> ActAsync(string parish, string ministry, string assignment, AssignmentActionDto request, CancellationToken ct)
    {
        var row = await ReadAssignmentAsync(parish, ministry, assignment, ct);
        var item = row.Value;
        var own = request.Action is "accept" or "request-cancel" || request.Action == "decline" && await IsOwnAsync(parish, item.PersonId, ct);
        if (own)
        {
            if (!await IsOwnAsync(parish, item.PersonId, ct))
                throw MinistryAccess.Missing();
        }
        else
            await access.RequireCoordinatorAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "volunteer-assignment-action:v1:" + assignment);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await CurrentAsync(parish, ministry, assignment, !own, ct);
        var slot = await ReadOpportunityAsync(parish, ministry, item.OpportunityId, ct);
        var seatChange = 0;
        switch (request.Action)
        {
            case "accept" when item.Status == "Invited":
                item.Status = "AwaitingConfirmation";
                item.NextActor = "Coordinator";
                item.RespondedAt = op.At;
                break;
            case "decline" when item.Status is "Invited" or "AwaitingConfirmation":
                item.Reason = own ? (string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Reason", 2000))
                    : Guard.Text(request.Reason, "Decline reason", 2000);
                item.Status = "Declined";
                item.NextActor = "None";
                item.RespondedAt = op.At;
                break;
            case "confirm" when item.Status == "AwaitingConfirmation":
                if (slot.Value.Status is not ("Open" or "Closed") || slot.Value.StartsAt <= op.At)
                    throw State("Only a future, uncancelled opportunity accepts confirmations.");
                if (slot.Value.Confirmed >= slot.Value.Capacity)
                    throw State("This opportunity is already fully staffed.");
                if (!await access.IsCurrentMemberAsync(parish, ministry, item.PersonId, op.At, ct))
                    throw State("Only a current, unarchived ministry member can be confirmed.");
                await RequireNoOverlapAsync(parish, item, ct);
                item.Status = "Confirmed";
                item.NextActor = "None";
                item.ConfirmedBy = actor.AccountId;
                item.ConfirmedAt = op.At;
                seatChange = 1;
                break;
            case "request-cancel" when item.Status == "Confirmed":
                // The volunteer stays committed until a coordinator releases them, so the vacancy is never hidden.
                item.Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Reason", 2000);
                item.Status = "CancellationRequested";
                item.NextActor = "Coordinator";
                break;
            case "approve-cancel" when item.Status == "CancellationRequested":
                item.Status = "Cancelled";
                item.NextActor = "None";
                item.CancelledAt = op.At;
                seatChange = -1;
                break;
            case "cancel" when item.Status is "Invited" or "AwaitingConfirmation" or "Confirmed" or "CancellationRequested":
                seatChange = item.Status is "Confirmed" or "CancellationRequested" ? -1 : 0;
                item.Reason = Guard.Text(request.Reason, "Cancellation reason", 2000);
                item.Status = "Cancelled";
                item.NextActor = "None";
                item.CancelledAt = op.At;
                break;
            case "complete" when item.Status == "Confirmed":
                if (slot.Value.EndsAt > op.At)
                    throw State("Mark the duty completed after the opportunity ends.");
                item.Status = "Completed";
                item.CompletedAt = op.At;
                break;
            default:
                throw State("This assignment action is not available in its current state.");
        }
        var changes = new List<RecordChange>
        {
            MinistryAccess.Fence(root),
            RecordChange.Replace(AssignmentKey(item.Id), "volunteerAssignment", item, Versions.Require(request.Version))
        };
        if (seatChange != 0)
        {
            slot.Value.Confirmed += seatChange;
            changes.Add(RecordChange.Replace(OpportunityKey(slot.Value.Id), "volunteerOpportunity", slot.Value, slot.Version));
        }
        await records.CommitAsync(scope, op, "ministry.volunteer_" + request.Action.Replace('-', '_'), ministry, changes,
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, !own);
    }

    public async Task<Page<Versioned<VolunteerAssignmentDto>>> TeamAsync(string parish, string ministry, string opportunity, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireCoordinatorAsync(parish, ministry, ct, readOnly: true);
        await ReadOpportunityAsync(parish, ministry, opportunity, ct);
        return AssignmentPage(await records.PageAsync<VolunteerAssignment>(MinistryAccess.Scope(parish), "volunteerAssignment", size, cursor, ct,
            Equal("opportunityId", opportunity)), true);
    }

    public async Task<Page<Versioned<VolunteerAssignmentDto>>> OwnAssignmentsAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        var link = await access.OwnLinkAsync(parish, ct);
        await access.ReadAsync(parish, ministry, ct);
        return AssignmentPage(await records.PageAsync<VolunteerAssignment>(MinistryAccess.Scope(parish), "volunteerAssignment", size, cursor, ct,
            Equal("ministryId", ministry), Equal("personId", link.Value.PersonId)), false);
    }

    public async Task<VolunteerHoursDto> SubmitHoursAsync(string parish, string ministry, string assignment, SubmitHoursDto request, CancellationToken ct)
    {
        var item = (await ReadAssignmentAsync(parish, ministry, assignment, ct)).Value;
        if (!await IsOwnAsync(parish, item.PersonId, ct))
            await access.RequireCoordinatorAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "volunteer-hours:v1:" + assignment);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return Project((await ReadHoursAsync(parish, ministry, assignment, ct)).Value);
        if (item.Status is not ("Confirmed" or "Completed") || item.StartsAt > op.At)
            throw State("Hours are submitted for a confirmed or completed duty that has started.");
        ValidateTimes(item, request.StartsAt, request.EndsAt, request.BreakMinutes, op.At);
        if (await records.ReadAsync<VolunteerHours>(scope, HoursKey(assignment), ct) is not null)
            throw State("Hours were already submitted for this duty; a reviewer corrects them instead.");
        var hours = new VolunteerHours
        {
            Id = assignment, ParishId = parish, MinistryId = ministry, PersonId = item.PersonId, AssignmentId = assignment,
            StartsAt = request.StartsAt, EndsAt = request.EndsAt, BreakMinutes = request.BreakMinutes,
            EvidenceReference = string.IsNullOrWhiteSpace(request.EvidenceReference) ? null : Guard.Text(request.EvidenceReference, "Evidence", 1000),
            SubmittedBy = actor.AccountId, SubmittedAt = op.At
        };
        await records.CommitAsync(scope, op, "ministry.volunteer_hours_submit", ministry,
            [MinistryAccess.Fence(root), RecordChange.Create(HoursKey(assignment), "volunteerHours", hours)],
            new CommandResult { Id = assignment, Status = hours.Status }, ct);
        return Project(hours);
    }

    public async Task<VolunteerHoursDto> HoursActionAsync(string parish, string ministry, string assignment, HoursActionDto request, CancellationToken ct)
    {
        await access.RequireCoordinatorAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "volunteer-hours-action:v1:" + assignment);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return Project((await ReadHoursAsync(parish, ministry, assignment, ct)).Value);
        var hours = (await ReadHoursAsync(parish, ministry, assignment, ct)).Value;
        // Actual hours are reviewed independently; a scheduled slot never stands in for time actually served.
        if (hours.Status != "Submitted" || hours.SubmittedBy == actor.AccountId)
            throw State("A different coordinator must review submitted hours.");
        switch (request.Action)
        {
            case "verify":
                break;
            case "correct":
                var item = (await ReadAssignmentAsync(parish, ministry, assignment, ct)).Value;
                if (request.StartsAt is not { } start || request.EndsAt is not { } end || request.BreakMinutes is not { } pause)
                    throw new DomainException("invalid_input", "Corrections give the actual start, end and break.");
                ValidateTimes(item, start, end, pause, op.At);
                hours.OriginalStartsAt = hours.StartsAt;
                hours.OriginalEndsAt = hours.EndsAt;
                hours.OriginalBreakMinutes = hours.BreakMinutes;
                hours.StartsAt = start;
                hours.EndsAt = end;
                hours.BreakMinutes = pause;
                hours.ReviewReason = Guard.Text(request.Reason, "Correction reason", 2000);
                break;
            case "reject":
                hours.ReviewReason = Guard.Text(request.Reason, "Rejection reason", 2000);
                break;
            default:
                throw State("Use verify, correct or reject.");
        }
        hours.Status = request.Action == "reject" ? "Rejected" : "Verified";
        hours.ReviewedBy = actor.AccountId;
        hours.ReviewedAt = op.At;
        await records.CommitAsync(scope, op, "ministry.volunteer_hours_" + request.Action, ministry,
            [MinistryAccess.Fence(root), RecordChange.Replace(HoursKey(assignment), "volunteerHours", hours, Versions.Require(request.Version))],
            new CommandResult { Id = assignment, Status = hours.Status }, ct);
        return Project(hours);
    }

    public async Task<Page<Versioned<VolunteerHoursDto>>> HoursAsync(string parish, string ministry, string person, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireCoordinatorAsync(parish, ministry, ct, readOnly: true);
        return HoursPage(await records.PageAsync<VolunteerHours>(MinistryAccess.Scope(parish), "volunteerHours", size, cursor, ct,
            Equal("ministryId", ministry), Equal("personId", person)));
    }

    public async Task<Page<Versioned<VolunteerHoursDto>>> OwnHoursAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        var link = await access.OwnLinkAsync(parish, ct);
        await access.ReadAsync(parish, ministry, ct);
        var page = HoursPage(await records.PageAsync<VolunteerHours>(MinistryAccess.Scope(parish), "volunteerHours", size, cursor, ct,
            Equal("ministryId", ministry), Equal("personId", link.Value.PersonId)));
        foreach (var row in page.Items)
            row.Value.ReviewedBy = null;
        return page;
    }

    private async Task RequireNoOverlapAsync(string parish, VolunteerAssignment item, CancellationToken ct)
    {
        // Committed duties across all of this parish's ministries block an overlapping confirmation; other parishes stay private.
        var committed = await records.CollectAsync<VolunteerAssignment>(MinistryAccess.Scope(parish), "volunteerAssignment", ct, 2000,
            Equal("personId", item.PersonId), new RecordCondition { Path = "status", Comparison = "in", Value = new[] { "Confirmed", "CancellationRequested" } });
        if (committed.Any(row => row.Value.Id != item.Id && row.Value.StartsAt < item.EndsAt && item.StartsAt < row.Value.EndsAt))
            throw State("This person already has an overlapping confirmed duty.");
    }

    private static void ValidateTimes(VolunteerAssignment item, DateTimeOffset start, DateTimeOffset end, int pause, DateTimeOffset now)
    {
        // Actual times must be plausible for this duty: ordered, not in the future and within twelve hours of the scheduled slot.
        if (Guard.Utc(start) >= Guard.Utc(end) || end > now || start < item.StartsAt.AddHours(-12) || end > item.EndsAt.AddHours(12)
            || pause < 0 || pause >= (end - start).TotalMinutes)
            throw new DomainException("invalid_input", "Give actual ordered UTC times near the scheduled duty and a break shorter than the time served.");
    }

    private async Task<bool> IsOwnAsync(string parish, string person, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
            return false;
        try { return (await access.OwnLinkAsync(parish, ct)).Value.PersonId == person; }
        catch (DomainException error) when (error.Kind == FailureKind.NotFound) { return false; }
    }

    private async Task<Versioned<VolunteerOpportunity>> ReadOpportunityAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<VolunteerOpportunity>(MinistryAccess.Scope(parish), OpportunityKey(id), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != id || row.Value.MinistryId != ministry || row.Value.ParishId != parish)
            throw MinistryAccess.Missing();
        return row;
    }

    private async Task<Versioned<VolunteerAssignment>> ReadAssignmentAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<VolunteerAssignment>(MinistryAccess.Scope(parish), AssignmentKey(id), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != id || row.Value.MinistryId != ministry || row.Value.ParishId != parish)
            throw MinistryAccess.Missing();
        return row;
    }

    private async Task<Versioned<VolunteerHours>> ReadHoursAsync(string parish, string ministry, string assignment, CancellationToken ct)
    {
        var row = await records.ReadAsync<VolunteerHours>(MinistryAccess.Scope(parish), HoursKey(assignment), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.AssignmentId != assignment || row.Value.MinistryId != ministry || row.Value.ParishId != parish)
            throw MinistryAccess.Missing();
        return row;
    }

    private async Task<VolunteerAssignmentDto> CurrentAsync(string parish, string ministry, string id, bool privileged, CancellationToken ct)
        => Project((await ReadAssignmentAsync(parish, ministry, id, ct)).Value, privileged);

    private static Page<Versioned<VolunteerOpportunityDto>> OpportunityPage(Page<Versioned<VolunteerOpportunity>> page) => new()
    {
        Items = page.Items.Select(row => new Versioned<VolunteerOpportunityDto> { Version = row.Version, Value = Project(row.Value) }).ToArray(),
        ContinuationToken = page.ContinuationToken
    };

    private static Page<Versioned<VolunteerAssignmentDto>> AssignmentPage(Page<Versioned<VolunteerAssignment>> page, bool privileged) => new()
    {
        Items = page.Items.Select(row => new Versioned<VolunteerAssignmentDto> { Version = row.Version, Value = Project(row.Value, privileged) }).ToArray(),
        ContinuationToken = page.ContinuationToken
    };

    private static Page<Versioned<VolunteerHoursDto>> HoursPage(Page<Versioned<VolunteerHours>> page) => new()
    {
        Items = page.Items.Select(row => new Versioned<VolunteerHoursDto> { Version = row.Version, Value = Project(row.Value) }).ToArray(),
        ContinuationToken = page.ContinuationToken
    };

    private static VolunteerOpportunityDto Project(VolunteerOpportunity x) => new()
    {
        Id = x.Id, MinistryId = x.MinistryId, Title = x.Title, Position = x.Position, Requirements = x.Requirements, Location = x.Location,
        StartsAt = x.StartsAt, EndsAt = x.EndsAt, Capacity = x.Capacity, Remaining = Math.Max(0, x.Capacity - x.Confirmed), Status = x.Status,
        SelfSignup = x.SelfSignup
    };

    private static VolunteerAssignmentDto Project(VolunteerAssignment x, bool privileged) => new()
    {
        Id = x.Id, OpportunityId = x.OpportunityId, PersonId = x.PersonId, StartsAt = x.StartsAt, EndsAt = x.EndsAt, Origin = x.Origin,
        Status = x.Status, NextActor = x.NextActor, CreatedAt = x.CreatedAt, RespondedAt = x.RespondedAt, ConfirmedAt = x.ConfirmedAt,
        CancelledAt = x.CancelledAt, CompletedAt = x.CompletedAt, Reason = x.Reason,
        CreatedBy = privileged ? x.CreatedBy : null, ConfirmedBy = privileged ? x.ConfirmedBy : null
    };

    private static VolunteerHoursDto Project(VolunteerHours x) => new()
    {
        Id = x.Id, AssignmentId = x.AssignmentId, PersonId = x.PersonId, StartsAt = x.StartsAt, EndsAt = x.EndsAt, BreakMinutes = x.BreakMinutes,
        Minutes = (int)(x.EndsAt - x.StartsAt).TotalMinutes - x.BreakMinutes, EvidenceReference = x.EvidenceReference, Status = x.Status,
        SubmittedBy = x.SubmittedBy, SubmittedAt = x.SubmittedAt, ReviewedBy = x.ReviewedBy, ReviewedAt = x.ReviewedAt, ReviewReason = x.ReviewReason,
        OriginalStartsAt = x.OriginalStartsAt, OriginalEndsAt = x.OriginalEndsAt, OriginalBreakMinutes = x.OriginalBreakMinutes
    };
}
