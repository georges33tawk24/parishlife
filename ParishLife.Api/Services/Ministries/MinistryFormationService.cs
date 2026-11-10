// Purpose: manages priest-approved ministry formation programs, member enrollments, milestone evidence/review/completion and append-only history.
// Main functions: CreateProgramAsync, ActProgramAsync, GetProgramAsync, ListProgramsAsync, EnrollAsync, ProgressAsync, EnrollmentActionAsync,
// GetEnrollmentAsync, ListEnrollmentsAsync, OwnEnrollmentsAsync and HistoryAsync; helpers enforce duties, separation of duties and safe projections.
// Completion is an explicitly recorded, reviewed result. Attendance is never converted into completion or sacramental eligibility.

using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public class MinistryFormationService(IRecordTransactions records, MinistryAccess access, ICurrentActor actor, TimeProvider clock)
{
    private static string ProgramKey(string id) => "formationProgram:" + id;
    private static string EnrollmentKey(string id) => "formationEnrollment:" + id;
    private static string ClaimKey(string program, string person) => "formationEnrollmentClaim:" + program + ":" + person;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException State(string message) => new("invalid_formation_state", message, FailureKind.Conflict);

    public async Task<FormationProgramDto> CreateProgramAsync(string parish, string ministry, CreateFormationDto request, CancellationToken ct)
    {
        var group = await access.RequireFormationAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "formation-program:v1:" + ministry);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } prior)
            return Project((await ReadProgramAsync(parish, ministry, prior.Id, ct)).Value);
        if (group.Value.Status != "Active")
            throw State("Formation programs belong to an active ministry.");
        var item = new FormationProgram
        {
            Id = op.Id, ParishId = parish, MinistryId = ministry, Title = Guard.Text(request.Title, "Program title", 500),
            Milestones = Milestones(request.Milestones), CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        if (request.SupersedesProgramId is { } supersedes)
        {
            var old = await ReadProgramAsync(parish, ministry, Guard.Id(supersedes), ct);
            if (old.Value.Status != "Approved")
                throw State("Only a currently approved program revision can be revised.");
            item.SupersedesProgramId = old.Value.Id;
            item.Revision = old.Value.Revision + 1;
        }
        await records.CommitAsync(scope, op, "ministry.formation_program_create", ministry,
            [MinistryAccess.Fence(root), RecordChange.Create(ProgramKey(item.Id), "formationProgram", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<FormationProgramDto> ActProgramAsync(string parish, string ministry, string program, FormationProgramActionDto request, CancellationToken ct)
    {
        // Approving the program content is a clergy decision; recording duties alone never approve a program.
        var root = await access.PriestAsync(parish, ct);
        var group = await access.ReadAsync(parish, ministry, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "formation-program-action:v1:" + program);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return Project((await ReadProgramAsync(parish, ministry, program, ct)).Value);
        var row = await ReadProgramAsync(parish, ministry, program, ct);
        var item = row.Value;
        var changes = new List<RecordChange> { MinistryAccess.Fence(root) };
        switch (request.Action)
        {
            case "approve" when item.Status == "Draft":
                if (group.Value.Status != "Active")
                    throw State("Formation programs belong to an active ministry.");
                item.ApprovalReference = Guard.Text(request.ApprovalReference, "Approval reference", 1000);
                item.Status = "Approved";
                item.ApprovedBy = actor.AccountId;
                item.ApprovedAt = op.At;
                if (item.SupersedesProgramId is { } supersedes)
                {
                    // Existing enrollments stay pinned to the old revision; only new enrollments use this one.
                    var old = await ReadProgramAsync(parish, ministry, supersedes, ct);
                    if (old.Value.Status != "Approved")
                        throw State("The revised program is no longer the current approved revision.");
                    old.Value.Status = "Superseded";
                    old.Value.RetiredBy = actor.AccountId;
                    old.Value.RetiredAt = op.At;
                    changes.Add(RecordChange.Replace(ProgramKey(old.Value.Id), "formationProgram", old.Value, old.Version));
                }
                break;
            case "retire" when item.Status is "Draft" or "Approved":
                item.RetirementReason = Guard.Text(request.Reason, "Retirement reason", 2000);
                item.Status = "Retired";
                item.RetiredBy = actor.AccountId;
                item.RetiredAt = op.At;
                break;
            default:
                throw State("This program action is not available in its current state.");
        }
        changes.Add(RecordChange.Replace(ProgramKey(item.Id), "formationProgram", item, Versions.Require(request.Version)));
        await records.CommitAsync(scope, op, "ministry.formation_program_" + request.Action, ministry, changes,
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<Versioned<FormationProgramDto>> GetProgramAsync(string parish, string ministry, string program, CancellationToken ct)
    {
        await access.RequireFormationAsync(parish, ministry, ct, readOnly: true);
        var row = await ReadProgramAsync(parish, ministry, program, ct);
        return new Versioned<FormationProgramDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<Page<Versioned<FormationProgramDto>>> ListProgramsAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireFormationAsync(parish, ministry, ct, readOnly: true);
        var page = await records.PageAsync<FormationProgram>(MinistryAccess.Scope(parish), "formationProgram", size, cursor, ct, Equal("ministryId", ministry));
        return new Page<Versioned<FormationProgramDto>>
        {
            Items = page.Items.Select(row => new Versioned<FormationProgramDto> { Version = row.Version, Value = Project(row.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<FormationEnrollmentDto> EnrollAsync(string parish, string ministry, string program, EnrollFormationDto request, CancellationToken ct)
    {
        var group = await access.RequireFormationAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var person = Guard.Id(request.PersonId);
        var op = actor.CreateOperation(request.OperationId, request, clock, "formation-enroll:v1:" + program + ":" + person);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } prior)
            return await CurrentAsync(parish, ministry, prior.Id, true, ct);
        var definition = await ReadProgramAsync(parish, ministry, program, ct);
        if (group.Value.Status != "Active" || definition.Value.Status != "Approved")
            throw State("Only an approved program revision of an active ministry accepts enrollments.");
        if (definition.Version != Versions.Require(request.ProgramVersion))
            throw new DomainException("write_conflict", "The program revision changed; review it before enrolling.", FailureKind.Conflict);
        await RequireCurrentMemberAsync(parish, ministry, person, op.At, ct);
        if (await records.ReadAsync<CommandResult>(scope, ClaimKey(program, person), ct) is not null)
            throw State("This person already has an enrollment in this program revision; reopen it instead of enrolling again.");
        var item = new FormationEnrollment
        {
            Id = op.Id, ParishId = parish, MinistryId = ministry, ProgramId = program, ProgramRevision = definition.Value.Revision,
            PersonId = person, EnrolledBy = actor.AccountId, EnrolledAt = op.At,
            Milestones = definition.Value.Milestones.Select(m => new FormationMilestoneProgress { Key = m.Key }).ToArray()
        };
        await records.CommitAsync(scope, op, "ministry.formation_enroll", ministry,
            [MinistryAccess.Fence(root),
             RecordChange.Create(EnrollmentKey(item.Id), "formationEnrollment", item),
             // The claim document makes a second concurrent enrollment of the same person/revision fail atomically.
             RecordChange.Create(ClaimKey(program, person), "formationEnrollmentClaim", new CommandResult { Id = item.Id, Status = "Enrolled" }),
             History(item, null, "Enrolled", "", item.Status, op, null, null, null)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, definition.Value, true);
    }

    public async Task<FormationEnrollmentDto> ProgressAsync(string parish, string ministry, string enrollment, FormationProgressDto request, CancellationToken ct)
    {
        var row = await ReadEnrollmentAsync(parish, ministry, enrollment, ct);
        var item = row.Value;
        var program = (await ReadProgramAsync(parish, ministry, item.ProgramId, ct)).Value;
        var definition = program.Milestones.SingleOrDefault(m => m.Key == request.MilestoneKey) ?? throw MinistryAccess.Missing();
        var own = await AuthorizeProgressAsync(parish, ministry, item, definition, request.Action, ct);
        var root = await access.RootAsync(parish, ct);
        var group = await access.ReadAsync(parish, ministry, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "formation-progress:v1:" + enrollment + ":" + definition.Key);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await CurrentAsync(parish, ministry, enrollment, !own, ct);
        if (group.Value.Status != "Active")
            throw State("Formation progress belongs to an active ministry.");
        if (item.Status != "Active" && !(request.Action == "reopen" && item.Status == "Completed"))
            throw State("Only an active enrollment accepts milestone progress.");
        var progress = item.Milestones.Single(m => m.Key == definition.Key);
        var previous = Copy(progress);
        string? reason = null;
        switch (request.Action)
        {
            case "start" when progress.Status == "Enrolled":
                await RequireCurrentMemberAsync(parish, ministry, item.PersonId, op.At, ct);
                RequirePrerequisites(item, definition);
                progress.Status = "InProgress";
                break;
            case "submit-evidence" when progress.Status == "InProgress"
                || progress.Status == "Enrolled" && request.Source == "ExternalPriorLearning":
                await RequireCurrentMemberAsync(parish, ministry, item.PersonId, op.At, ct);
                RequirePrerequisites(item, definition);
                RecordEvidence(progress, request, op);
                progress.Status = "EvidenceSubmitted";
                break;
            case "resubmit" when progress.Status == "NeedsInformation":
                await RequireCurrentMemberAsync(parish, ministry, item.PersonId, op.At, ct);
                RecordEvidence(progress, request, op);
                progress.Status = progress.ResumeStatus ?? "EvidenceSubmitted";
                progress.ResumeStatus = null;
                break;
            case "review" when progress.Status == "EvidenceSubmitted":
                RequireIndependentReviewer(progress);
                progress.ReviewReference = Guard.Text(request.ReviewReference, "Review reference", 1000);
                progress.ReviewedBy = actor.AccountId;
                progress.ReviewedAt = op.At;
                progress.Status = "Reviewed";
                break;
            case "complete" when progress.Status == "Reviewed":
                RequireIndependentReviewer(progress);
                RequirePrerequisites(item, definition);
                progress.CompletedBy = actor.AccountId;
                progress.CompletedAt = op.At;
                progress.Status = "Completed";
                if (item.Milestones.All(m => m.Status == "Completed"))
                {
                    item.Status = "Completed";
                    item.CompletedAt = op.At;
                }
                break;
            case "return" when progress.Status is "EvidenceSubmitted" or "Reviewed":
                // The applicant explanation is visible to the learner; the private review reference is not.
                reason = Guard.Text(request.Reason, "Applicant-visible explanation", 2000);
                progress.ApplicantExplanation = reason;
                progress.ResumeStatus = "EvidenceSubmitted";
                ClearReview(progress);
                progress.Status = "NeedsInformation";
                break;
            case "reopen" when progress.Status == "Completed":
                // Reopening returns the milestone to review; it never restores an earlier approval.
                reason = Guard.Text(request.Reason, "Reopening reason", 2000);
                ClearReview(progress);
                progress.CompletedBy = null;
                progress.CompletedAt = null;
                progress.Status = "EvidenceSubmitted";
                if (item.Status == "Completed")
                {
                    item.Status = "Active";
                    item.CompletedAt = null;
                }
                break;
            default:
                throw State("This milestone action is not available in its current state.");
        }
        await records.CommitAsync(scope, op, "ministry.formation_" + request.Action.Replace('-', '_'), ministry,
            [MinistryAccess.Fence(root),
             RecordChange.Replace(EnrollmentKey(item.Id), "formationEnrollment", item, Versions.Require(request.Version)),
             History(item, definition.Key, request.Action, previous.Status, progress.Status, op, reason, previous, Copy(progress))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, program, !own);
    }

    public async Task<FormationEnrollmentDto> EnrollmentActionAsync(string parish, string ministry, string enrollment, FormationEnrollmentActionDto request, CancellationToken ct)
    {
        var row = await ReadEnrollmentAsync(parish, ministry, enrollment, ct);
        var item = row.Value;
        var own = false;
        if (request.Action == "reopen")
            await access.PriestAsync(parish, ct);
        else if (item.Milestones.All(m => m.Status == "Enrolled") && await IsOwnLearnerAsync(parish, item.PersonId, ct))
            own = true; // A learner may withdraw only an enrollment nobody has started handling.
        else
            await access.RequireFormationAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "formation-enrollment-action:v1:" + enrollment);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await CurrentAsync(parish, ministry, enrollment, !own, ct);
        var reason = Guard.Text(request.Reason, "Reason", 2000);
        var from = item.Status;
        switch (request.Action)
        {
            case "withdraw" when item.Status == "Active":
                item.Status = "Withdrawn";
                item.WithdrawnBy = actor.AccountId;
                item.WithdrawnAt = op.At;
                item.WithdrawalReason = reason;
                break;
            case "reopen" when item.Status == "Withdrawn":
                await RequireCurrentMemberAsync(parish, ministry, item.PersonId, op.At, ct);
                item.Status = "Active";
                item.WithdrawnBy = null;
                item.WithdrawnAt = null;
                item.WithdrawalReason = null;
                break;
            default:
                throw State("This enrollment action is not available in its current state.");
        }
        await records.CommitAsync(scope, op, "ministry.formation_enrollment_" + request.Action, ministry,
            [MinistryAccess.Fence(root),
             RecordChange.Replace(EnrollmentKey(item.Id), "formationEnrollment", item, Versions.Require(request.Version)),
             History(item, null, request.Action, from, item.Status, op, reason, null, null)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await CurrentAsync(parish, ministry, enrollment, !own, ct);
    }

    public async Task<Versioned<FormationEnrollmentDto>> GetEnrollmentAsync(string parish, string ministry, string enrollment, CancellationToken ct)
    {
        await access.RequireFormationAsync(parish, ministry, ct, readOnly: true);
        var row = await ReadEnrollmentAsync(parish, ministry, enrollment, ct);
        var program = (await ReadProgramAsync(parish, ministry, row.Value.ProgramId, ct)).Value;
        return new Versioned<FormationEnrollmentDto> { Version = row.Version, Value = Project(row.Value, program, true) };
    }

    public async Task<Page<Versioned<FormationEnrollmentDto>>> ListEnrollmentsAsync(string parish, string ministry, string? status,
        int size, string? cursor, CancellationToken ct)
    {
        await access.RequireFormationAsync(parish, ministry, ct, readOnly: true);
        if (status is not (null or "Active" or "Completed" or "Withdrawn"))
            throw new DomainException("invalid_input", "Use Active, Completed or Withdrawn.");
        RecordCondition[] conditions = status is null ? [Equal("ministryId", ministry)] : [Equal("ministryId", ministry), Equal("status", status)];
        var page = await records.PageAsync<FormationEnrollment>(MinistryAccess.Scope(parish), "formationEnrollment", size, cursor, ct, conditions);
        return await ProjectPageAsync(parish, ministry, page, true, ct);
    }

    public async Task<Page<Versioned<FormationEnrollmentDto>>> OwnEnrollmentsAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        var link = await access.OwnLinkAsync(parish, ct);
        await access.ReadAsync(parish, ministry, ct);
        var page = await records.PageAsync<FormationEnrollment>(MinistryAccess.Scope(parish), "formationEnrollment", size, cursor, ct,
            Equal("ministryId", ministry), Equal("personId", link.Value.PersonId));
        return await ProjectPageAsync(parish, ministry, page, false, ct);
    }

    public async Task<Page<FormationHistoryDto>> HistoryAsync(string parish, string ministry, string person, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireFormationAsync(parish, ministry, ct, readOnly: true);
        var page = await records.PageAsync<FormationHistory>(MinistryAccess.Scope(parish), "formationChange", size, cursor, ct,
            Equal("ministryId", ministry), Equal("personId", person));
        var programs = new Dictionary<string, FormationProgram>(StringComparer.Ordinal);
        var items = new List<FormationHistoryDto>();
        foreach (var row in page.Items)
        {
            var program = await CachedProgramAsync(parish, ministry, row.Value.ProgramId, programs, ct);
            var definition = program.Milestones.SingleOrDefault(m => m.Key == row.Value.MilestoneKey);
            items.Add(new FormationHistoryDto
            {
                Id = row.Value.Id, EnrollmentId = row.Value.EnrollmentId, MilestoneKey = row.Value.MilestoneKey, Action = row.Value.Action,
                FromStatus = row.Value.FromStatus, ToStatus = row.Value.ToStatus, RecordedBy = row.Value.RecordedBy,
                RecordedAt = row.Value.RecordedAt, Reason = row.Value.Reason,
                Previous = row.Value.Previous is null || definition is null ? null : Project(row.Value.Previous, definition, true),
                Current = row.Value.Current is null || definition is null ? null : Project(row.Value.Current, definition, true)
            });
        }
        return new Page<FormationHistoryDto> { Items = items, ContinuationToken = page.ContinuationToken };
    }

    // Returns true when the caller acts as the learner on their own enrollment rather than as staff.
    private async Task<bool> AuthorizeProgressAsync(string parish, string ministry, FormationEnrollment item, FormationMilestone definition,
        string action, CancellationToken ct)
    {
        switch (action)
        {
            case "start" when await IsOwnLearnerAsync(parish, item.PersonId, ct):
                return true;
            case "start" or "submit-evidence" or "resubmit":
                await access.RequireFormationAsync(parish, ministry, ct);
                return false;
            case "review" or "return":
                await access.RequireFormationAsync(parish, ministry, ct, review: true);
                return false;
            case "complete":
                await access.RequireFormationAsync(parish, ministry, ct, review: true);
                // Milestones needing clergy authority are completed only by a current qualified priest.
                if (definition.ClergyApproval)
                    await access.PriestAsync(parish, ct);
                return false;
            case "reopen":
                await access.PriestAsync(parish, ct);
                return false;
            default:
                throw State("Unsupported milestone action.");
        }
    }

    private async Task<bool> IsOwnLearnerAsync(string parish, string person, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
            return false;
        try { return (await access.OwnLinkAsync(parish, ct)).Value.PersonId == person; }
        catch (DomainException error) when (error.Kind == FailureKind.NotFound) { return false; }
    }

    private void RequireIndependentReviewer(FormationMilestoneProgress progress)
    {
        // Proposed separation of duties: whoever recorded the evidence cannot also review or complete it.
        if (progress.RecordedBy == actor.AccountId)
            throw State("A different qualified reviewer must review and complete evidence you recorded.");
    }

    private static void RequirePrerequisites(FormationEnrollment item, FormationMilestone definition)
    {
        if (definition.PrerequisiteKeys.Any(key => item.Milestones.Single(m => m.Key == key).Status != "Completed"))
            throw State("Complete this milestone's prerequisites first.");
    }

    private void RecordEvidence(FormationMilestoneProgress progress, FormationProgressDto request, Operation op)
    {
        var source = request.Source ?? "Course";
        progress.EvidenceReference = Guard.Text(request.EvidenceReference, "Evidence reference", 1000);
        progress.Source = source;
        progress.ExternalProvenance = source == "ExternalPriorLearning" ? Guard.Text(request.ExternalProvenance, "External learning provenance", 1000) : null;
        // The latest UTC+14 calendar date bounds "today" in every parish time zone, so no local date is rejected as future.
        var latest = DateOnly.FromDateTime(op.At.UtcDateTime.AddHours(14));
        if (request.AchievedOn is not { } achieved || achieved > latest || achieved.Year < 1900)
            throw new DomainException("invalid_input", "An actual achievement date that is not in the future is required.");
        progress.AchievedOn = achieved;
        progress.RecordedBy = actor.AccountId;
        progress.RecordedAt = op.At;
        progress.ApplicantExplanation = null;
        ClearReview(progress);
    }

    private static void ClearReview(FormationMilestoneProgress progress)
    {
        progress.ReviewedBy = null;
        progress.ReviewedAt = null;
        progress.ReviewReference = null;
    }

    private async Task RequireCurrentMemberAsync(string parish, string ministry, string person, DateTimeOffset at, CancellationToken ct)
    {
        if (!await access.IsCurrentMemberAsync(parish, ministry, person, at, ct))
            throw State("New formation work is limited to a current, unarchived ministry member.");
    }

    private static FormationMilestone[] Milestones(FormationMilestoneDto[]? input)
    {
        if (input is null || input.Length is < 1 or > 30)
            throw new DomainException("invalid_input", "Use 1–30 milestones.");
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<FormationMilestone>();
        foreach (var milestone in input)
        {
            var key = milestone.Key?.Trim() ?? "";
            if (key.Length is < 1 or > 40 || !seen.Add(key))
                throw new DomainException("invalid_input", "Milestone keys must be present and unique.");
            var prerequisites = milestone.PrerequisiteKeys ?? [];
            // Prerequisites must name earlier milestones, which keeps every program acyclic.
            if (prerequisites.Distinct(StringComparer.Ordinal).Count() != prerequisites.Length
                || prerequisites.Any(item => item == key || !seen.Contains(item)))
                throw new DomainException("invalid_input", "Prerequisites must be distinct earlier milestones.");
            result.Add(new FormationMilestone
            {
                Key = key, Title = Guard.Text(milestone.Title, "Milestone title", 300),
                PrerequisiteKeys = [.. prerequisites], ClergyApproval = milestone.ClergyApproval
            });
        }
        return [.. result];
    }

    private async Task<Versioned<FormationProgram>> ReadProgramAsync(string parish, string ministry, string program, CancellationToken ct)
    {
        var row = await records.ReadAsync<FormationProgram>(MinistryAccess.Scope(parish), ProgramKey(program), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != program || row.Value.MinistryId != ministry || row.Value.ParishId != parish)
            throw MinistryAccess.Missing();
        return row;
    }

    private async Task<Versioned<FormationEnrollment>> ReadEnrollmentAsync(string parish, string ministry, string enrollment, CancellationToken ct)
    {
        var row = await records.ReadAsync<FormationEnrollment>(MinistryAccess.Scope(parish), EnrollmentKey(enrollment), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != enrollment || row.Value.MinistryId != ministry || row.Value.ParishId != parish)
            throw MinistryAccess.Missing();
        return row;
    }

    private async Task<FormationProgram> CachedProgramAsync(string parish, string ministry, string program,
        Dictionary<string, FormationProgram> cache, CancellationToken ct)
    {
        if (!cache.TryGetValue(program, out var value))
            cache[program] = value = (await ReadProgramAsync(parish, ministry, program, ct)).Value;
        return value;
    }

    private async Task<FormationEnrollmentDto> CurrentAsync(string parish, string ministry, string enrollment, bool privileged, CancellationToken ct)
    {
        var row = await ReadEnrollmentAsync(parish, ministry, enrollment, ct);
        return Project(row.Value, (await ReadProgramAsync(parish, ministry, row.Value.ProgramId, ct)).Value, privileged);
    }

    private async Task<Page<Versioned<FormationEnrollmentDto>>> ProjectPageAsync(string parish, string ministry,
        Page<Versioned<FormationEnrollment>> page, bool privileged, CancellationToken ct)
    {
        var programs = new Dictionary<string, FormationProgram>(StringComparer.Ordinal);
        var items = new List<Versioned<FormationEnrollmentDto>>();
        foreach (var row in page.Items)
            items.Add(new Versioned<FormationEnrollmentDto>
            {
                Version = row.Version,
                Value = Project(row.Value, await CachedProgramAsync(parish, ministry, row.Value.ProgramId, programs, ct), privileged)
            });
        return new Page<Versioned<FormationEnrollmentDto>> { Items = items, ContinuationToken = page.ContinuationToken };
    }

    private RecordChange History(FormationEnrollment item, string? milestone, string action, string from, string to, Operation op,
        string? reason, FormationMilestoneProgress? previous, FormationMilestoneProgress? current)
        => RecordChange.Create("formationChange:" + op.Id, "formationChange", new FormationHistory
        {
            Id = op.Id, MinistryId = item.MinistryId, PersonId = item.PersonId, EnrollmentId = item.Id, ProgramId = item.ProgramId, MilestoneKey = milestone,
            Action = action, FromStatus = from, ToStatus = to, RecordedBy = actor.AccountId, RecordedAt = op.At,
            Reason = reason, Previous = previous, Current = current
        });

    private static FormationMilestoneProgress Copy(FormationMilestoneProgress value) => new()
    {
        Key = value.Key, Status = value.Status, ResumeStatus = value.ResumeStatus, EvidenceReference = value.EvidenceReference,
        Source = value.Source, ExternalProvenance = value.ExternalProvenance, AchievedOn = value.AchievedOn,
        RecordedBy = value.RecordedBy, RecordedAt = value.RecordedAt, ReviewedBy = value.ReviewedBy, ReviewedAt = value.ReviewedAt,
        ReviewReference = value.ReviewReference, CompletedBy = value.CompletedBy, CompletedAt = value.CompletedAt,
        ApplicantExplanation = value.ApplicantExplanation
    };

    private static FormationProgramDto Project(FormationProgram item) => new()
    {
        Id = item.Id, MinistryId = item.MinistryId, Title = item.Title, Revision = item.Revision,
        SupersedesProgramId = item.SupersedesProgramId, Status = item.Status,
        Milestones = item.Milestones.Select(m => new FormationMilestoneDto
        {
            Key = m.Key, Title = m.Title, PrerequisiteKeys = [.. m.PrerequisiteKeys], ClergyApproval = m.ClergyApproval
        }).ToArray(),
        CreatedBy = item.CreatedBy, CreatedAt = item.CreatedAt, ApprovedBy = item.ApprovedBy, ApprovedAt = item.ApprovedAt,
        ApprovalReference = item.ApprovalReference, RetiredAt = item.RetiredAt, RetirementReason = item.RetirementReason
    };

    private static FormationEnrollmentDto Project(FormationEnrollment item, FormationProgram program, bool privileged) => new()
    {
        Id = item.Id, MinistryId = item.MinistryId, ProgramId = item.ProgramId, ProgramTitle = program.Title,
        ProgramRevision = item.ProgramRevision, PersonId = item.PersonId, Status = item.Status, EnrolledAt = item.EnrolledAt,
        EnrolledBy = privileged ? item.EnrolledBy : null, CompletedAt = item.CompletedAt, WithdrawnAt = item.WithdrawnAt,
        WithdrawalReason = privileged ? item.WithdrawalReason : null,
        Milestones = item.Milestones.Select(m => Project(m, program.Milestones.Single(d => d.Key == m.Key), privileged)).ToArray()
    };

    // Own projections show progress and applicant explanations only; evidence, provenance, reviewers and review references stay staff-only.
    private static FormationMilestoneProgressDto Project(FormationMilestoneProgress item, FormationMilestone definition, bool privileged) => new()
    {
        Key = item.Key, Title = definition.Title, ClergyApproval = definition.ClergyApproval, Status = item.Status,
        ResumeStatus = item.ResumeStatus, Source = item.Source, AchievedOn = item.AchievedOn, CompletedAt = item.CompletedAt,
        ApplicantExplanation = item.ApplicantExplanation,
        EvidenceReference = privileged ? item.EvidenceReference : null,
        ExternalProvenance = privileged ? item.ExternalProvenance : null,
        RecordedBy = privileged ? item.RecordedBy : null,
        ReviewedBy = privileged ? item.ReviewedBy : null,
        ReviewReference = privileged ? item.ReviewReference : null,
        CompletedBy = privileged ? item.CompletedBy : null
    };
}
