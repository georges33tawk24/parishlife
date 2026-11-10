// Purpose: verifies ministry formation programs, enrollments and milestone lifecycle through real local services, storage, cookies and CSRF.
// Main tests: approved-program path with clergy sign-off; prerequisites and separation of duties; returned information and reopened review
// with retained history; withdrawal and reviewed reopening; revision pinning; retries and stale versions; scope boundaries; HTTP access.
// Helpers create an isolated ministry with a current member, separate recorder/reviewer leaders and approved programs.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryFormationTests
{
    private sealed record Setup(LocalBackendFixture F, MinistryScenario S, string Ministry, string Recorder, string Reviewer,
        (string AccountId, string PersonId, string Username) Learner)
    {
        public MinistryFormationService Service => F.Services.GetRequiredService<MinistryFormationService>();
        public string Parish => S.Parish;
    }

    [Fact]
    public async Task Approved_program_is_completed_only_through_recorded_evidence_review_and_clergy_sign_off()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var program = await ApprovedProgramAsync(x);
        Assert.Equal("Approved", program.Status);
        var enrollment = await EnrollAsync(x, program.Id);
        Assert.All(enrollment.Milestones, m => Assert.Equal("Enrolled", m.Status));

        // The learner may start their own milestone but never records evidence.
        f.As(x.Learner.AccountId, mfa: false);
        Assert.Equal("InProgress", Milestone(await StepAsync(x, enrollment.Id, "basics", "start"), "basics").Status);
        await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "basics", "submit-evidence", Evidence(x, "learner claim")));

        f.As(x.Recorder);
        Assert.Equal("invalid_formation_state", (await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "commissioning", "start"))).Code);
        await StepAsync(x, enrollment.Id, "basics", "submit-evidence", Evidence(x, "Isolated session sign-in sheet"));
        await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "basics", "review", Review));
        await CompleteAsync(x, enrollment.Id, "basics");

        f.As(x.Recorder);
        await StepAsync(x, enrollment.Id, "commissioning", "start");
        await StepAsync(x, enrollment.Id, "commissioning", "submit-evidence", Evidence(x, "Isolated commissioning preparation"));
        f.As(x.Reviewer);
        await StepAsync(x, enrollment.Id, "commissioning", "review", Review);
        // A clergy milestone cannot be completed by a lay reviewer.
        await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "commissioning", "complete"));
        x.S.Use();
        var done = await StepAsync(x, enrollment.Id, "commissioning", "complete");
        Assert.Equal("Completed", done.Status);
        Assert.NotNull(done.CompletedAt);
        Assert.Equal(f.Other, Milestone(done, "commissioning").CompletedBy);

        f.As(x.Learner.AccountId, mfa: false);
        var mine = Assert.Single((await x.Service.OwnEnrollmentsAsync(x.Parish, x.Ministry, 25, null, default)).Items).Value;
        Assert.Equal("Completed", mine.Status);
        Assert.Contains("not a sacramental certificate", mine.OutputLabel);
        Assert.All(mine.Milestones, m =>
        {
            Assert.Equal("Completed", m.Status);
            Assert.NotNull(m.AchievedOn);
            Assert.Null(m.EvidenceReference);
            Assert.Null(m.ReviewReference);
            Assert.Null(m.ReviewedBy);
            Assert.Null(m.CompletedBy);
        });
        x.S.Use();
        var history = await x.Service.HistoryAsync(x.Parish, x.Ministry, x.Learner.PersonId, 100, null, default);
        Assert.Equal(9, history.Items.Count);
        // Storage paging order is unspecified; callers order by RecordedAt, so compare the recorded actions as a set.
        Assert.Equal(["Enrolled", "complete", "review", "start", "submit-evidence"],
            history.Items.Where(h => h.MilestoneKey is null or "basics").Select(h => h.Action).Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task Program_validation_prerequisites_and_independent_review_are_enforced()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Recorder);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.CreateProgramAsync(x.Parish, x.Ministry, new CreateFormationDto
        {
            OperationId = Guid.NewGuid(), Title = "Cyclic",
            Milestones = [new() { Key = "a", Title = "A", PrerequisiteKeys = ["b"] }, new() { Key = "b", Title = "B", PrerequisiteKeys = [] }]
        }, default));
        // Drafts are not enrollable until a priest approves them, and a recorder cannot approve.
        var draft = await x.Service.CreateProgramAsync(x.Parish, x.Ministry, ProgramRequest(), default);
        await Assert.ThrowsAsync<DomainException>(async () => await x.Service.ActProgramAsync(x.Parish, x.Ministry, draft.Id, new FormationProgramActionDto
        {
            OperationId = Guid.NewGuid(), Version = await ProgramVersionAsync(x, draft.Id), Action = "approve", ApprovalReference = "Not a priest"
        }, default));
        await Assert.ThrowsAsync<DomainException>(async () => await x.Service.EnrollAsync(x.Parish, x.Ministry, draft.Id, new EnrollFormationDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(x.Learner.PersonId), ProgramVersion = await ProgramVersionAsync(x, draft.Id)
        }, default));

        var program = await ApprovedProgramAsync(x);
        var enrollment = await EnrollAsync(x, program.Id);
        // The priest holds both duties here, so separation of duties is the only barrier left to test.
        x.S.Use();
        await StepAsync(x, enrollment.Id, "basics", "start");
        await StepAsync(x, enrollment.Id, "basics", "submit-evidence", Evidence(x, "Priest-recorded evidence"));
        Assert.Equal("invalid_formation_state",
            (await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "basics", "review", Review))).Code);
        f.As(x.Reviewer);
        await StepAsync(x, enrollment.Id, "basics", "review", Review);
        x.S.Use();
        await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "basics", "complete"));

        // External prior learning is reviewed, not duplicated, and must state its provenance.
        f.As(x.Recorder);
        await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "commissioning", "submit-evidence", r =>
        {
            Evidence(x, "External certificate")(r);
            r.Source = "ExternalPriorLearning";
        }));
        f.As(x.Reviewer);
        await StepAsync(x, enrollment.Id, "basics", "complete");
        f.As(x.Recorder);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "commissioning", "submit-evidence", r =>
        {
            Evidence(x, "External certificate")(r);
            r.Source = "ExternalPriorLearning";
        }))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "commissioning", "submit-evidence", r =>
        {
            Evidence(x, "Future-dated evidence")(r);
            r.Source = "ExternalPriorLearning";
            r.ExternalProvenance = "Isolated neighbouring parish course record";
            r.AchievedOn = DateOnly.FromDateTime(f.Clock.Now.UtcDateTime).AddDays(5);
        }))).Code);
        var external = await StepAsync(x, enrollment.Id, "commissioning", "submit-evidence", r =>
        {
            Evidence(x, "External certificate")(r);
            r.Source = "ExternalPriorLearning";
            r.ExternalProvenance = "Isolated neighbouring parish course record";
        });
        Assert.Equal("EvidenceSubmitted", Milestone(external, "commissioning").Status);
        Assert.Equal("ExternalPriorLearning", Milestone(external, "commissioning").Source);
    }

    [Fact]
    public async Task Returned_information_and_reopened_review_preserve_prior_versions_in_history()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var enrollment = await EnrollAsync(x, (await ApprovedProgramAsync(x)).Id);
        f.As(x.Recorder);
        await StepAsync(x, enrollment.Id, "basics", "start");
        await StepAsync(x, enrollment.Id, "basics", "submit-evidence", Evidence(x, "First incomplete evidence"));
        f.As(x.Reviewer);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "basics", "return"))).Code);
        var returned = await StepAsync(x, enrollment.Id, "basics", "return", r => r.Reason = "Please add the retreat attendance date.");
        Assert.Equal("NeedsInformation", Milestone(returned, "basics").Status);
        Assert.Equal("EvidenceSubmitted", Milestone(returned, "basics").ResumeStatus);

        f.As(x.Learner.AccountId, mfa: false);
        var own = Milestone(Assert.Single((await x.Service.OwnEnrollmentsAsync(x.Parish, x.Ministry, 25, null, default)).Items).Value, "basics");
        Assert.Equal("Please add the retreat attendance date.", own.ApplicantExplanation);
        Assert.Null(own.EvidenceReference);

        f.As(x.Recorder);
        var resubmitted = await StepAsync(x, enrollment.Id, "basics", "resubmit", Evidence(x, "Corrected evidence with retreat date"));
        Assert.Equal("EvidenceSubmitted", Milestone(resubmitted, "basics").Status);
        Assert.Null(Milestone(resubmitted, "basics").ApplicantExplanation);
        await CompleteAsync(x, enrollment.Id, "basics", startedAndSubmitted: true);

        f.As(x.Recorder);
        await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "basics", "reopen", r => r.Reason = "Not competent"));
        x.S.Use();
        var reopened = await StepAsync(x, enrollment.Id, "basics", "reopen", r => r.Reason = "Evidence belonged to another person.");
        var basics = Milestone(reopened, "basics");
        Assert.Equal("EvidenceSubmitted", basics.Status);
        Assert.Null(basics.CompletedBy);
        Assert.Null(basics.ReviewedBy);
        Assert.Equal("Corrected evidence with retreat date", basics.EvidenceReference);

        var history = (await x.Service.HistoryAsync(x.Parish, x.Ministry, x.Learner.PersonId, 100, null, default)).Items;
        var correction = Assert.Single(history, h => h.Action == "resubmit");
        Assert.Equal("First incomplete evidence", correction.Previous!.EvidenceReference);
        Assert.Equal("Corrected evidence with retreat date", correction.Current!.EvidenceReference);
        var reopening = Assert.Single(history, h => h.Action == "reopen");
        Assert.Equal("Completed", reopening.Previous!.Status);
        Assert.Equal(x.Reviewer, reopening.Previous.CompletedBy);
        Assert.Equal("Evidence belonged to another person.", reopening.Reason);
    }

    [Fact]
    public async Task Withdrawal_stops_progress_and_only_a_priest_reopens_it()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var program = await ApprovedProgramAsync(x);
        var enrollment = await EnrollAsync(x, program.Id);

        // A learner may withdraw only while nobody has handled the enrollment.
        f.As(x.Learner.AccountId, mfa: false);
        var withdrawn = await EnrollmentActionAsync(x, enrollment.Id, "withdraw", "Personal schedule conflict");
        Assert.Equal("Withdrawn", withdrawn.Status);
        Assert.Null(withdrawn.WithdrawalReason);
        await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "basics", "start"));
        f.As(x.Recorder);
        await Assert.ThrowsAsync<DomainException>(() => EnrollmentActionAsync(x, enrollment.Id, "reopen", "Recorder cannot reopen"));
        // The claim prevents a duplicate enrollment instead of silently replacing the withdrawn one.
        Assert.Equal("invalid_formation_state", (await Assert.ThrowsAsync<DomainException>(() => EnrollAsync(x, program.Id))).Code);
        x.S.Use();
        Assert.Equal("Active", (await EnrollmentActionAsync(x, enrollment.Id, "reopen", "Learner returned to the group")).Status);

        f.As(x.Learner.AccountId, mfa: false);
        await StepAsync(x, enrollment.Id, "basics", "start");
        await Assert.ThrowsAsync<DomainException>(() => EnrollmentActionAsync(x, enrollment.Id, "withdraw", "Already handled"));
        f.As(x.Recorder);
        var staffWithdrawal = await EnrollmentActionAsync(x, enrollment.Id, "withdraw", "Recorded by the coordinator");
        Assert.Equal("Recorded by the coordinator", staffWithdrawal.WithdrawalReason);
        var history = (await x.Service.HistoryAsync(x.Parish, x.Ministry, x.Learner.PersonId, 100, null, default)).Items;
        Assert.Equal(["Enrolled", "reopen", "start", "withdraw", "withdraw"], history.Select(h => h.Action).Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task Revisions_pin_existing_enrollments_and_only_the_current_approved_revision_accepts_new_ones()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var first = await ApprovedProgramAsync(x);
        var enrollment = await EnrollAsync(x, first.Id);
        f.As(x.Recorder);
        var draft = await x.Service.CreateProgramAsync(x.Parish, x.Ministry, ProgramRequest(first.Id), default);
        Assert.Equal(2, draft.Revision);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.CreateProgramAsync(x.Parish, x.Ministry, ProgramRequest(draft.Id), default));
        var second = await ApproveAsync(x, draft.Id);
        x.S.Use();
        Assert.Equal("Superseded", (await x.Service.GetProgramAsync(x.Parish, x.Ministry, first.Id, default)).Value.Status);

        f.As(x.Recorder);
        var pinned = await StepAsync(x, enrollment.Id, "basics", "start");
        Assert.Equal(first.Id, pinned.ProgramId);
        Assert.Equal(1, pinned.ProgramRevision);
        var current = await EnrollAsync(x, second.Id);
        Assert.Equal(2, current.ProgramRevision);

        // Retirement stops new enrollments only; the existing pinned enrollment keeps progressing.
        x.S.Use();
        var retired = await x.Service.ActProgramAsync(x.Parish, x.Ministry, second.Id, new FormationProgramActionDto
        {
            OperationId = Guid.NewGuid(), Version = await ProgramVersionAsync(x, second.Id), Action = "retire", Reason = "Replaced by a new course"
        }, default);
        Assert.Equal("Retired", retired.Status);
        Assert.Equal("Replaced by a new course", retired.RetirementReason);
        f.As(x.Recorder);
        Assert.Equal("InProgress", Milestone(await StepAsync(x, current.Id, "basics", "start"), "basics").Status);
    }

    [Fact]
    public async Task Retries_replay_without_duplicates_and_stale_versions_change_nothing()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var program = await ApprovedProgramAsync(x);
        f.As(x.Recorder);
        var enroll = new EnrollFormationDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(x.Learner.PersonId), ProgramVersion = await ProgramVersionAsync(x, program.Id)
        };
        var enrollment = await x.Service.EnrollAsync(x.Parish, x.Ministry, program.Id, enroll, default);
        Assert.Equal(enrollment.Id, (await x.Service.EnrollAsync(x.Parish, x.Ministry, program.Id, enroll, default)).Id);

        var stale = await EnrollmentVersionAsync(x, enrollment.Id);
        var start = new FormationProgressDto { OperationId = Guid.NewGuid(), Version = stale, MilestoneKey = "basics", Action = "start" };
        await x.Service.ProgressAsync(x.Parish, x.Ministry, enrollment.Id, start, default);
        // Retrying the committed request (for example after a dropped response) returns the current state once.
        Assert.Equal("InProgress", Milestone(await x.Service.ProgressAsync(x.Parish, x.Ministry, enrollment.Id, start, default), "basics").Status);
        var conflict = await Assert.ThrowsAsync<DomainException>(() => x.Service.ProgressAsync(x.Parish, x.Ministry, enrollment.Id,
            new FormationProgressDto { OperationId = Guid.NewGuid(), Version = stale, MilestoneKey = "basics", Action = "submit-evidence",
                EvidenceReference = "Stale evidence", AchievedOn = DateOnly.FromDateTime(f.Clock.Now.UtcDateTime) }, default));
        Assert.Equal("write_conflict", conflict.Code);
        x.S.Use();
        Assert.Equal("InProgress", Milestone((await x.Service.GetEnrollmentAsync(x.Parish, x.Ministry, enrollment.Id, default)).Value, "basics").Status);
        Assert.Equal(2, (await x.Service.HistoryAsync(x.Parish, x.Ministry, x.Learner.PersonId, 100, null, default)).Items.Count);
    }

    [Fact]
    public async Task Unassigned_actors_other_parishes_and_non_members_cannot_read_or_change_formation()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var program = await ApprovedProgramAsync(x);
        var enrollment = await EnrollAsync(x, program.Id);

        var plainLeader = await f.CreateVerifiedStaffAsync();
        await AppointAsync(x.S, x.Ministry, plainLeader, null);
        f.As(plainLeader);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.ListEnrollmentsAsync(x.Parish, x.Ministry, null, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.HistoryAsync(x.Parish, x.Ministry, x.Learner.PersonId, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.CreateProgramAsync(x.Parish, x.Ministry, ProgramRequest(), default));

        var other = await x.S.LinkedApplicantAsync();
        f.As(other.AccountId, mfa: false);
        Assert.Empty((await x.Service.OwnEnrollmentsAsync(x.Parish, x.Ministry, 25, null, default)).Items);
        await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, enrollment.Id, "basics", "start"));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GetEnrollmentAsync(x.Parish, x.Ministry, enrollment.Id, default));
        // A linked parish person who is not a current member cannot be enrolled.
        f.As(x.Recorder);
        Assert.Equal("invalid_formation_state", (await Assert.ThrowsAsync<DomainException>(async () => await x.Service.EnrollAsync(x.Parish, x.Ministry, program.Id, new EnrollFormationDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(other.PersonId), ProgramVersion = await ProgramVersionAsync(x, program.Id)
        }, default))).Code);

        var otherParish = await f.JurisdictionParishAsync(x.S.Staff.Organization);
        x.S.Use();
        await Assert.ThrowsAsync<DomainException>(() => x.Service.ListEnrollmentsAsync(otherParish, x.Ministry, null, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GetEnrollmentAsync(otherParish, x.Ministry, enrollment.Id, default));
    }

    [Fact]
    public async Task Leaders_receive_formation_duties_only_from_a_priest_holding_them()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var group = await s.MinistryAsync();
        var account = await f.CreateVerifiedStaffAsync();
        await Assert.ThrowsAsync<DomainException>(() => AppointAsync(s, group.Id, account, "formation.record"));
        await Assert.ThrowsAsync<DomainException>(() => AppointAsync(s, group.Id, account, "formation.review"));
    }

    [Fact]
    public async Task Formation_HTTP_requires_identity_and_CSRF_and_returns_only_the_learner_projection_to_members()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        using var priest = factory.Client();
        using var member = factory.Client();
        var path = $"/api/parishes/{x.Parish}/ministries/{x.Ministry}/formation";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path + "/enrollments/mine")).StatusCode);

        await MinistryHttpTests.LoginAsync(priest, "other@fixture.example", mfa: true);
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", x.S.Appointment);
        await MinistryHttpTests.LoginAsync(member, x.Learner.Username);
        priest.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.False((await priest.PostAsJsonAsync(path + "/programs", ProgramRequest())).IsSuccessStatusCode);
        await MinistryHttpTests.CsrfAsync(priest);
        var draft = await MinistryHttpTests.ReadAsync<FormationProgramDto>(await priest.PostAsJsonAsync(path + "/programs", ProgramRequest()));
        var current = await MinistryHttpTests.ReadAsync<Versioned<FormationProgramDto>>(await priest.GetAsync($"{path}/programs/{draft.Id}"));
        var approved = await MinistryHttpTests.ReadAsync<FormationProgramDto>(await priest.PostAsJsonAsync($"{path}/programs/{draft.Id}/actions",
            new FormationProgramActionDto { OperationId = Guid.NewGuid(), Version = current.Version, Action = "approve", ApprovalReference = "Isolated HTTP approval" }));
        Assert.Equal("Approved", approved.Status);
        current = await MinistryHttpTests.ReadAsync<Versioned<FormationProgramDto>>(await priest.GetAsync($"{path}/programs/{draft.Id}"));
        await MinistryHttpTests.ReadAsync<FormationEnrollmentDto>(await priest.PostAsJsonAsync($"{path}/programs/{draft.Id}/enrollments",
            new EnrollFormationDto { OperationId = Guid.NewGuid(), PersonId = Guid.Parse(x.Learner.PersonId), ProgramVersion = current.Version }));

        Assert.False((await member.PostAsJsonAsync(path + "/programs", ProgramRequest())).IsSuccessStatusCode);
        Assert.False((await member.GetAsync(path + "/enrollments")).IsSuccessStatusCode);
        var own = await member.GetAsync(path + "/enrollments/mine");
        var json = await own.Content.ReadAsStringAsync();
        Assert.True(own.IsSuccessStatusCode, json);
        Assert.Contains("Isolated formation program", json);
        Assert.DoesNotContain("Isolated HTTP approval", json);
        Assert.DoesNotContain(f.Other, json);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesFormationRecord, Permissions.MinistriesFormationReview]);
        var group = await s.MinistryAsync();
        var learner = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(group.Id, learner.AccountId);
        await s.ApplicationActionAsync(group.Id, join.Id, "approve");
        var recorder = await f.CreateVerifiedStaffAsync();
        var reviewer = await f.CreateVerifiedStaffAsync();
        await AppointAsync(s, group.Id, recorder, "formation.record");
        await AppointAsync(s, group.Id, reviewer, "formation.review");
        return new Setup(f, s, group.Id, recorder, reviewer, learner);
    }

    private static async Task AppointAsync(MinistryScenario s, string ministry, string account, string? duty)
    {
        s.Use();
        await s.Fixture.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, ministry, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(),
            MinistryVersion = (await s.Ministries.GetAsync(s.Parish, ministry, default)).Version,
            AccountId = Guid.Parse(account), Role = "Leader", Duties = duty is null ? [] : [duty],
            StartsAt = s.Fixture.Clock.Now, EvidenceReference = "Isolated formation duty appointment"
        }, default);
    }

    private static CreateFormationDto ProgramRequest(string? supersedes = null) => new()
    {
        OperationId = Guid.NewGuid(), Title = "Isolated formation program",
        SupersedesProgramId = supersedes is null ? null : Guid.Parse(supersedes),
        Milestones =
        [
            new() { Key = "basics", Title = "Foundations sessions", PrerequisiteKeys = [] },
            new() { Key = "commissioning", Title = "Commissioning readiness", PrerequisiteKeys = ["basics"], ClergyApproval = true }
        ]
    };

    private static async Task<FormationProgramDto> ApprovedProgramAsync(Setup x)
    {
        x.F.As(x.Recorder);
        var draft = await x.Service.CreateProgramAsync(x.Parish, x.Ministry, ProgramRequest(), default);
        Assert.Equal("Draft", draft.Status);
        return await ApproveAsync(x, draft.Id);
    }

    private static async Task<FormationProgramDto> ApproveAsync(Setup x, string program)
    {
        x.S.Use();
        return await x.Service.ActProgramAsync(x.Parish, x.Ministry, program, new FormationProgramActionDto
        {
            OperationId = Guid.NewGuid(), Version = await ProgramVersionAsync(x, program), Action = "approve",
            ApprovalReference = "Isolated priest approval record"
        }, default);
    }

    private static async Task<FormationEnrollmentDto> EnrollAsync(Setup x, string program)
    {
        x.F.As(x.Recorder);
        return await x.Service.EnrollAsync(x.Parish, x.Ministry, program, new EnrollFormationDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(x.Learner.PersonId), ProgramVersion = await ProgramVersionAsync(x, program)
        }, default);
    }

    private static async Task CompleteAsync(Setup x, string enrollment, string milestone, bool startedAndSubmitted = false)
    {
        if (!startedAndSubmitted)
        {
            x.F.As(x.Recorder);
            var status = Milestone((await CurrentAsync(x, enrollment)), milestone).Status;
            if (status == "Enrolled") await StepAsync(x, enrollment, milestone, "start");
            if (status != "EvidenceSubmitted") await StepAsync(x, enrollment, milestone, "submit-evidence", Evidence(x, "Isolated evidence"));
        }
        x.F.As(x.Reviewer);
        await StepAsync(x, enrollment, milestone, "review", Review);
        await StepAsync(x, enrollment, milestone, "complete");
    }

    private static async Task<FormationEnrollmentDto> StepAsync(Setup x, string enrollment, string milestone, string action,
        Action<FormationProgressDto>? configure = null)
    {
        var request = new FormationProgressDto
        {
            OperationId = Guid.NewGuid(), Version = await EnrollmentVersionAsync(x, enrollment), MilestoneKey = milestone, Action = action
        };
        configure?.Invoke(request);
        return await x.Service.ProgressAsync(x.Parish, x.Ministry, enrollment, request, default);
    }

    private static async Task<FormationEnrollmentDto> EnrollmentActionAsync(Setup x, string enrollment, string action, string reason)
        => await x.Service.EnrollmentActionAsync(x.Parish, x.Ministry, enrollment, new FormationEnrollmentActionDto
        {
            OperationId = Guid.NewGuid(), Version = await EnrollmentVersionAsync(x, enrollment), Action = action, Reason = reason
        }, default);

    private static Action<FormationProgressDto> Evidence(Setup x, string reference) => request =>
    {
        request.EvidenceReference = reference;
        request.AchievedOn = DateOnly.FromDateTime(x.F.Clock.Now.UtcDateTime);
    };

    private static void Review(FormationProgressDto request) => request.ReviewReference = "Isolated qualified review record";

    private static FormationMilestoneProgressDto Milestone(FormationEnrollmentDto enrollment, string key)
        => enrollment.Milestones.Single(m => m.Key == key);

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> ProgramVersionAsync(Setup x, string program)
        => (await Records(x).ReadAsync<FormationProgram>(MinistryAccess.Scope(x.Parish), "formationProgram:" + program, default))!.Version;

    private static async Task<string> EnrollmentVersionAsync(Setup x, string enrollment)
        => (await Records(x).ReadAsync<FormationEnrollment>(MinistryAccess.Scope(x.Parish), "formationEnrollment:" + enrollment, default))!.Version;

    private static async Task<FormationEnrollmentDto> CurrentAsync(Setup x, string enrollment)
    {
        var row = (await Records(x).ReadAsync<FormationEnrollment>(MinistryAccess.Scope(x.Parish), "formationEnrollment:" + enrollment, default))!;
        return new FormationEnrollmentDto { Id = row.Value.Id, Milestones = row.Value.Milestones.Select(m => new FormationMilestoneProgressDto { Key = m.Key, Status = m.Status }).ToArray() };
    }

    private static IRecordTransactions Records(Setup x) => x.F.Services.GetRequiredService<IRecordTransactions>();
}
