// Purpose: verifies custom form fields/conditional rules (W01) and workflow runs with step results, pause/cancel/reopen (W02)
// through the real local services, storage, grants and selected appointments.
// Main tests: template validation and immutable published versions; server-side conditional show/require rules, step branches and version
// pinning; current-step permissions, restricted-answer privacy and protected storage; pause/resume/cancel/reopen and Open/PausedNew/SafetyStop
// modes; exact replay and stale versions; recovery and wrong-capacity refusal; anonymous HTTP refusal on an isolated storage path.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Workflows;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Workflows;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class WorkflowTests
{
    // Reviewer acts through a selected priest appointment (exact capacity); the others act through explicit parish grants.
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario S, string Owner, string Starter, string ReviewerAppointment, string Approver, string Outsider)
    {
        public string Reviewer => F.Other;
        public WorkflowDefinitionService Definitions => F.Services.GetRequiredService<WorkflowDefinitionService>();
        public WorkflowRunService Runs => F.Services.GetRequiredService<WorkflowRunService>();
        public string Parish => S.Parish;
        public void AsOwner() => F.As(Owner);
        public void As(string account) { if (account == Reviewer) F.AsAppointment(F.Other, ReviewerAppointment); else F.As(account); }
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "finance", "facilities"]);
        var reviewer = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.FacilitiesManage]));
        var owner = await f.CreateVerifiedStaffAsync();
        var starter = await f.CreateVerifiedStaffAsync();
        var approver = await f.CreateVerifiedStaffAsync();
        var outsider = await f.CreateVerifiedStaffAsync();
        await GrantAsync(staff, owner, [Permissions.WorkflowsManage]);
        await GrantAsync(staff, starter, [Permissions.RequestsManage]);
        await GrantAsync(staff, approver, [Permissions.FinanceApprove]);
        await GrantAsync(staff, outsider, [Permissions.PeopleRead]);
        return new Setup(f, staff, owner, starter, reviewer.Id, approver, outsider);
    }

    private static async Task GrantAsync(StaffAppointmentScenario staff, string account, string[] allows)
    {
        staff.Fixture.As(staff.Fixture.FirstAdmin);
        await staff.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(account), Allows = allows, StartsAt = staff.Fixture.Clock.Now
        }, default);
    }

    // Purchase-style example: kind/needsRoom drive conditional show/require; medical is restricted; the room step only applies when needed.
    private static WorkflowTemplateDto Template(string label = "Kind") => new()
    {
        StartPermission = Permissions.RequestsManage,
        Fields =
        [
            new RegistrationField { Key = "kind", Label = label, Type = "Choice", Required = true, Options = ["Purchase", "Repair"] },
            new RegistrationField { Key = "details", Label = "Repair details", Type = "Text", Required = true, VisibleWhenField = "kind", VisibleWhenValue = "Repair" },
            new RegistrationField { Key = "needsRoom", Label = "Needs a room", Type = "Boolean" },
            new RegistrationField { Key = "roomName", Label = "Room", Type = "Text", RequiredWhenField = "needsRoom", RequiredWhenValue = "true" },
            new RegistrationField { Key = "medical", Label = "Accessibility needs", Type = "Text" }
        ],
        RestrictedFieldKeys = ["medical"],
        Steps =
        [
            new WorkflowStepDto { Key = "room", Title = "Room check", Permission = Permissions.FacilitiesManage, WhenField = "needsRoom", WhenValue = "true" },
            new WorkflowStepDto { Key = "review", Title = "Triage", Permission = Permissions.FacilitiesManage },
            new WorkflowStepDto { Key = "approve", Title = "Independent approval", Permission = Permissions.FinanceApprove, ViewsRestricted = true }
        ]
    };

    private static async Task<(string Definition, WorkflowVersionDto Version)> PublishedAsync(Setup x)
    {
        x.AsOwner();
        var created = await x.Definitions.CreateAsync(x.Parish, new CreateWorkflowDefinitionDto { OperationId = Guid.NewGuid(), Title = "Purchase request", Template = Template() }, default);
        var version = await x.Definitions.PublishAsync(x.Parish, created.Value.Id, new PublishWorkflowDto { OperationId = Guid.NewGuid(), Version = created.Version }, default);
        return (created.Value.Id, version);
    }

    private static Dictionary<string, string> Answers(bool room = false) => room
        ? new() { ["kind"] = "Purchase", ["needsRoom"] = "true", ["roomName"] = "Hall", ["medical"] = "Isolated restricted answer" }
        : new() { ["kind"] = "Purchase", ["needsRoom"] = "false", ["medical"] = "Isolated restricted answer" };

    private static async Task<Versioned<WorkflowRunDto>> StartAsync(Setup x, string definition, string version, Dictionary<string, string>? answers = null, Guid? op = null)
    {
        x.F.Clock.Now = x.F.Clock.Now.AddMinutes(1);
        x.F.As(x.Starter);
        return await x.Runs.StartAsync(x.Parish, definition, new StartWorkflowRunDto { OperationId = op ?? Guid.NewGuid(), VersionId = Guid.Parse(version), Answers = answers ?? Answers() }, default);
    }

    private static async Task<Versioned<WorkflowRunDto>> StepAsync(Setup x, string actor, string run, string step, string result = "Completed", string? note = null, string? version = null)
    {
        version ??= await VersionAsync(x, run);
        x.F.Clock.Now = x.F.Clock.Now.AddMinutes(1);
        x.As(actor);
        return await x.Runs.StepAsync(x.Parish, run, new RecordWorkflowStepDto { OperationId = Guid.NewGuid(), Version = version, StepKey = step, Result = result, Note = note }, default);
    }

    private static async Task<Versioned<WorkflowRunDto>> ActAsync(Setup x, string run, string action, string reason = "Isolated process-owner decision")
    {
        var version = await VersionAsync(x, run);
        x.F.Clock.Now = x.F.Clock.Now.AddMinutes(1);
        x.AsOwner();
        return await x.Runs.ActAsync(x.Parish, run, new WorkflowRunActionDto { OperationId = Guid.NewGuid(), Version = version, Action = action, Reason = reason }, default);
    }

    private static async Task<string> VersionAsync(Setup x, string run)
    {
        x.AsOwner();
        return (await x.Runs.GetAsync(x.Parish, run, default)).Version;
    }

    private static async Task<string> CodeAsync(Func<Task> action) => (await Assert.ThrowsAsync<DomainException>(action)).Code;

    [Fact]
    public async Task Templates_are_validated_and_publishing_pins_immutable_versions_for_process_owners_only()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.AsOwner();
        async Task<string> Invalid(Action<WorkflowTemplateDto> change)
        {
            var template = Template();
            change(template);
            x.AsOwner();
            return await CodeAsync(() => x.Definitions.CreateAsync(x.Parish, new CreateWorkflowDefinitionDto { OperationId = Guid.NewGuid(), Title = "Invalid", Template = template }, default));
        }
        Assert.Equal("invalid_workflow_permission", await Invalid(t => t.Steps[1].Permission = "made.up"));
        Assert.Equal("invalid_workflow_permission", await Invalid(t => t.StartPermission = "self.promote"));
        Assert.Equal("invalid_condition", await Invalid(t => t.Fields[1].VisibleWhenValue = "Unknown"));
        Assert.Equal("invalid_condition", await Invalid(t => t.Fields[0].VisibleWhenField = "kind"));
        Assert.Equal("invalid_condition", await Invalid(t => t.Fields[3].Required = true));
        Assert.Equal("invalid_condition", await Invalid(t => t.Steps[0].WhenValue = "maybe"));
        Assert.Equal("invalid_restricted_fields", await Invalid(t => t.RestrictedFieldKeys = ["missing"]));
        Assert.Equal("invalid_workflow_steps", await Invalid(t => t.Steps = [t.Steps[0]]));

        f.As(x.Starter);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Definitions.CreateAsync(x.Parish,
            new CreateWorkflowDefinitionDto { OperationId = Guid.NewGuid(), Title = "Starter", Template = Template() }, default))).Kind);
        f.AsRecovery(x.Owner);
        Assert.Equal("mfa_required", await CodeAsync(() => x.Definitions.ListAsync(x.Parish, 25, null, default)));

        x.AsOwner();
        var create = new CreateWorkflowDefinitionDto { OperationId = Guid.NewGuid(), Title = "Purchase request", Template = Template() };
        var created = await x.Definitions.CreateAsync(x.Parish, create, default);
        Assert.Equal(created.Value.Id, (await x.Definitions.CreateAsync(x.Parish, create, default)).Value.Id);
        var saved = await x.Definitions.SaveDraftAsync(x.Parish, created.Value.Id, new SaveWorkflowDraftDto
        {
            OperationId = Guid.NewGuid(), Version = created.Version, Title = "Purchase request", Template = Template("Request kind")
        }, default);
        Assert.Equal("write_conflict", await CodeAsync(() => x.Definitions.PublishAsync(x.Parish, created.Value.Id,
            new PublishWorkflowDto { OperationId = Guid.NewGuid(), Version = created.Version }, default)));
        var publish = new PublishWorkflowDto { OperationId = Guid.NewGuid(), Version = saved.Version };
        var first = await x.Definitions.PublishAsync(x.Parish, created.Value.Id, publish, default);
        Assert.Equal(first.Id, (await x.Definitions.PublishAsync(x.Parish, created.Value.Id, publish, default)).Id);
        Assert.Equal(1, first.Number);

        var head = await x.Definitions.GetAsync(x.Parish, created.Value.Id, default);
        var edited = await x.Definitions.SaveDraftAsync(x.Parish, created.Value.Id, new SaveWorkflowDraftDto
        {
            OperationId = Guid.NewGuid(), Version = head.Version, Title = "Purchase request", Template = Template("Changed label")
        }, default);
        var second = await x.Definitions.PublishAsync(x.Parish, created.Value.Id, new PublishWorkflowDto { OperationId = Guid.NewGuid(), Version = edited.Version }, default);
        Assert.Equal(2, second.Number);

        // The earlier version is unchanged, and starters may preview a published form while unrelated staff learn nothing.
        f.As(x.Starter);
        Assert.Equal("Request kind", (await x.Definitions.VersionAsync(x.Parish, created.Value.Id, first.Id, default)).Template.Fields[0].Label);
        Assert.Equal("Changed label", (await x.Definitions.VersionAsync(x.Parish, created.Value.Id, second.Id, default)).Template.Fields[0].Label);
        f.As(x.Outsider);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Definitions.VersionAsync(x.Parish, created.Value.Id, first.Id, default))).Kind);
    }

    [Fact]
    public async Task Runs_apply_conditional_rules_server_side_and_pin_the_viewed_version()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (definition, version) = await PublishedAsync(x);

        Assert.Equal("answer_required", await CodeAsync(() => StartAsync(x, definition, version.Id, new() { ["kind"] = "Purchase", ["needsRoom"] = "true" })));
        Assert.Equal("answer_required", await CodeAsync(() => StartAsync(x, definition, version.Id, new() { ["kind"] = "Repair" })));
        Assert.Equal("hidden_answer", await CodeAsync(() => StartAsync(x, definition, version.Id, new() { ["kind"] = "Purchase", ["details"] = "Not applicable" })));
        Assert.Equal("unknown_answers", await CodeAsync(() => StartAsync(x, definition, version.Id, new() { ["kind"] = "Purchase", ["extra"] = "x" })));
        x.As(x.Reviewer);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Runs.StartAsync(x.Parish, definition,
            new StartWorkflowRunDto { OperationId = Guid.NewGuid(), VersionId = Guid.Parse(version.Id), Answers = Answers() }, default))).Kind);

        var op = Guid.NewGuid();
        var skipped = await StartAsync(x, definition, version.Id, Answers(), op);
        Assert.Equal(skipped.Value.Id, (await StartAsync(x, definition, version.Id, Answers(), op)).Value.Id);
        Assert.Equal(["Skipped", "Pending", "Pending"], skipped.Value.Steps.Select(s => s.Status));
        Assert.Equal("review", skipped.Value.CurrentStepKey);
        var withRoom = await StartAsync(x, definition, version.Id, Answers(room: true));
        Assert.Equal("room", withRoom.Value.CurrentStepKey);

        // A newer published version makes the viewed one stale for new runs, while the running case keeps its pinned version.
        x.AsOwner();
        var head = await x.Definitions.GetAsync(x.Parish, definition, default);
        await x.Definitions.PublishAsync(x.Parish, definition, new PublishWorkflowDto { OperationId = Guid.NewGuid(), Version = head.Version }, default);
        Assert.Equal("workflow_version_changed", await CodeAsync(() => StartAsync(x, definition, version.Id)));
        x.AsOwner();
        Assert.Equal(version.Id, (await x.Runs.GetAsync(x.Parish, skipped.Value.Id, default)).Value.VersionId);
    }

    [Fact]
    public async Task Steps_need_the_current_step_permission_and_restricted_answers_stay_private()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (definition, version) = await PublishedAsync(x);
        var run = (await StartAsync(x, definition, version.Id)).Value.Id;

        // Starter sees own restricted answer; the triage reviewer does not; the restricted reader does; unrelated staff learn nothing.
        f.As(x.Starter);
        Assert.Equal("Isolated restricted answer", (await x.Runs.GetAsync(x.Parish, run, default)).Value.Answers["medical"]);
        x.As(x.Reviewer);
        var reviewerView = (await x.Runs.GetAsync(x.Parish, run, default)).Value;
        Assert.False(reviewerView.Answers.ContainsKey("medical"));
        Assert.Equal(["medical"], reviewerView.RedactedFieldKeys);
        Assert.Single((await x.Runs.WorklistAsync(x.Parish, 25, null, default)).Items, r => r.Value.Id == run);
        f.As(x.Approver);
        Assert.Equal("Isolated restricted answer", (await x.Runs.GetAsync(x.Parish, run, default)).Value.Answers["medical"]);
        Assert.Empty((await x.Runs.WorklistAsync(x.Parish, 25, null, default)).Items);
        f.As(x.Outsider);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Runs.GetAsync(x.Parish, run, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Runs.HistoryAsync(x.Parish, run, 25, null, default))).Kind);
        x.AsOwner();
        Assert.DoesNotContain((await x.Runs.ListAsync(x.Parish, definition, null, 25, null, default)).Items, r => r.Value.Answers.ContainsKey("medical"));
        var raw = (await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<WorkflowRun>(
            new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "workflowRun:" + run, default))!.Value;
        Assert.DoesNotContain("Isolated restricted answer", raw.ProtectedRestrictedAnswers);
        Assert.False(raw.Answers.ContainsKey("medical"));

        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, x.Starter, run, "review"))).Kind);
        Assert.Equal("workflow_step_not_current", await CodeAsync(() => StepAsync(x, x.Approver, run, "approve")));
        Assert.Equal("invalid_input", await CodeAsync(() => StepAsync(x, x.Reviewer, run, "review", "Declined")));
        var stale = await VersionAsync(x, run);
        var reviewed = await StepAsync(x, x.Reviewer, run, "review", note: "Triage done");
        Assert.Equal("approve", reviewed.Value.CurrentStepKey);
        Assert.Equal(x.Reviewer, reviewed.Value.Steps.Single(s => s.Key == "review").CompletedBy);
        Assert.Equal("write_conflict", await CodeAsync(() => StepAsync(x, x.Approver, run, "approve", version: stale)));
        // The selected facilities appointment cannot borrow the finance approval the step requires.
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => StepAsync(x, x.Reviewer, run, "approve"))).Kind);
        var closed = await StepAsync(x, x.Approver, run, "approve");
        Assert.Equal("Completed", closed.Value.Status);
        Assert.NotNull(closed.Value.ClosedAt);
        Assert.Equal("workflow_run_state", await CodeAsync(() => StepAsync(x, x.Approver, run, "approve")));

        // Reopening redoes the final step in a new cycle; the earlier results remain in immutable history.
        var reopened = await ActAsync(x, run, "reopen");
        Assert.Equal(("InProgress", 2, "approve"), (reopened.Value.Status, reopened.Value.Cycle, reopened.Value.CurrentStepKey));
        Assert.Equal("Completed", reopened.Value.Steps.Single(s => s.Key == "review").Status);
        x.AsOwner();
        var history = (await x.Runs.HistoryAsync(x.Parish, run, 50, null, default)).Items;
        Assert.Equal(["Started", "StepCompleted", "StepCompleted", "Reopened"], history.Select(h => h.Action));
        Assert.Equal(x.ReviewerAppointment, history[1].ActingAppointmentId);
        Assert.Null(history[2].ActingAppointmentId);
        Assert.Equal(x.Approver, history[2].By);
        Assert.Equal(x.Owner, history[3].By);
    }

    [Fact]
    public async Task Pause_cancel_reopen_and_definition_modes_have_explicit_effects()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (definition, version) = await PublishedAsync(x);
        var run = (await StartAsync(x, definition, version.Id)).Value.Id;

        f.As(x.Starter);
        var current = (await x.Runs.GetAsync(x.Parish, run, default)).Version;
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Runs.ActAsync(x.Parish, run,
            new WorkflowRunActionDto { OperationId = Guid.NewGuid(), Version = current, Action = "cancel", Reason = "Not mine to cancel" }, default))).Kind);
        Assert.Equal("invalid_input", await CodeAsync(() => ActAsync(x, run, "pause", " ")));
        Assert.Equal("workflow_run_state", await CodeAsync(() => ActAsync(x, run, "resume")));

        var actionOp = Guid.NewGuid();
        var pauseVersion = await VersionAsync(x, run);
        x.AsOwner();
        var pause = new WorkflowRunActionDto { OperationId = actionOp, Version = pauseVersion, Action = "pause", Reason = "Waiting for quotes" };
        Assert.Equal("Paused", (await x.Runs.ActAsync(x.Parish, run, pause, default)).Value.Status);
        Assert.Equal("Paused", (await x.Runs.ActAsync(x.Parish, run, pause, default)).Value.Status);
        Assert.Equal("workflow_run_state", await CodeAsync(() => StepAsync(x, x.Reviewer, run, "review")));
        Assert.Equal("InProgress", (await ActAsync(x, run, "resume")).Value.Status);

        // PausedNew blocks only new runs; SafetyStop also freezes progress, resumption and reopening, while cancelling stays possible.
        async Task ModeAsync(string mode)
        {
            x.AsOwner();
            var head = await x.Definitions.GetAsync(x.Parish, definition, default);
            await x.Definitions.SetModeAsync(x.Parish, definition, new SetWorkflowModeDto { OperationId = Guid.NewGuid(), Version = head.Version, Mode = mode, Reason = "Isolated mode change" }, default);
        }
        await ModeAsync("PausedNew");
        Assert.Equal("workflow_paused", await CodeAsync(() => StartAsync(x, definition, version.Id)));
        await StepAsync(x, x.Reviewer, run, "review");
        await ModeAsync("SafetyStop");
        Assert.Equal("workflow_safety_stop", await CodeAsync(() => StepAsync(x, x.Approver, run, "approve")));
        await ActAsync(x, run, "pause");
        Assert.Equal("workflow_safety_stop", await CodeAsync(() => ActAsync(x, run, "resume")));
        var cancelled = await ActAsync(x, run, "cancel", "Supplier withdrew");
        Assert.Equal("Cancelled", cancelled.Value.Status);
        Assert.Equal("workflow_safety_stop", await CodeAsync(() => ActAsync(x, run, "reopen")));
        await ModeAsync("Open");
        var reopened = await ActAsync(x, run, "reopen", "Supplier returned");
        Assert.Equal(("InProgress", "approve", 2), (reopened.Value.Status, reopened.Value.CurrentStepKey, reopened.Value.Cycle));

        // A declined step ends the run with its reason; reopening resumes at that step.
        var declined = await StepAsync(x, x.Approver, run, "approve", "Declined", "Over budget");
        Assert.Equal("Declined", declined.Value.Status);
        Assert.Equal("Over budget", declined.Value.Steps.Single(s => s.Key == "approve").Note);
        Assert.Equal("approve", (await ActAsync(x, run, "reopen")).Value.CurrentStepKey);
    }

    [Fact]
    public async Task Http_refuses_anonymous_workflow_access_on_isolated_storage()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        var parish = Guid.NewGuid().ToString("N");
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/parishes/{parish}/workflows")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/parishes/{parish}/workflow-runs/worklist")).StatusCode);
        Assert.False((await anonymous.PostAsJsonAsync($"/api/parishes/{parish}/workflows", new CreateWorkflowDefinitionDto())).IsSuccessStatusCode);
    }
}
