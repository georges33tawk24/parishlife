// Purpose: verifies source-scoped notice outcomes for parish status changes, incident assignments and concern reviewer updates (N04 follow-up).
// Main tests: only the authorized source actor sees Pending/Stored for the exact source; unrelated, recovery and submitter actors get nothing;
// Pending stays honest when the recipient is not currently eligible, and no response carries recipient or work identifiers.

using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Care;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Care;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CareStatusNotificationOutcomeTests
{
    private static async Task<LocalBackendFixture> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        return f;
    }

    [Fact]
    public async Task Parish_status_owner_notice_outcome_is_bishop_only_and_replays()
    {
        await using var f = await StartAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var status = f.Services.GetRequiredService<ParishStatusService>();

        f.As(f.Nominee);
        var request = new ParishStatusActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version, Action = "suspend", Reason = "Isolated bishop decision"
        };
        var changed = await status.ChangeAsync(staff.Parish, request, default);
        Assert.Equal("Stored", changed.NotificationOutcome?.Status);
        Assert.Equal("Stored", (await status.ChangeAsync(staff.Parish, request, default)).NotificationOutcome?.Status);
        Assert.Equal("Stored", (await status.NotificationOutcomeAsync(staff.Parish, changed.Id, default)).Status);
        // History lists stay light and do not carry per-change outcomes.
        Assert.Null(Assert.Single(await status.HistoryAsync(staff.Parish, default)).NotificationOutcome);
        AssertNoIdentifiers(changed);

        foreach (var outsider in new[] { f.Other, f.FirstAdmin })
        {
            f.As(outsider);
            await Assert.ThrowsAsync<DomainException>(() => status.NotificationOutcomeAsync(staff.Parish, changed.Id, default));
        }
        f.AsRecovery(f.Nominee);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => status.NotificationOutcomeAsync(staff.Parish, changed.Id, default))).Code);
        f.As(f.Nominee);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() =>
            status.NotificationOutcomeAsync(staff.Parish, Guid.NewGuid().ToString("N"), default))).Kind);
    }

    [Fact]
    public async Task Incident_assignment_outcome_is_handler_only_and_pending_is_kept_for_an_ineligible_handler()
    {
        await using var f = await StartAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var handler = await staff.AcceptAsync(await staff.InviteAsync(f.Other,
            allows: [Permissions.PeopleRead, Permissions.PeopleWrite, Permissions.IncidentsRecord, Permissions.IncidentsManage]));
        var recorderAccount = await f.CreateVerifiedStaffAsync();
        var recorder = await staff.AcceptAsync(await staff.InviteAsync(recorderAccount, allows: [Permissions.IncidentsRecord]));
        var service = f.Services.GetRequiredService<IncidentService>();

        f.AsAppointment(f.Other, handler.Id);
        var child = (await f.Services.GetRequiredService<PeopleService>().CreateAsync(staff.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Child", FamilyName = "Isolated", BirthDate = new DateOnly(2015, 3, 1)
        }, default)).Id;
        f.AsAppointment(recorderAccount, recorder.Id);
        var receipt = await service.RecordAsync(staff.Parish, new RecordIncidentDto
        {
            OperationId = Guid.NewGuid(), OccurredAt = f.Clock.Now.AddHours(-1), PersonIds = [Guid.Parse(child)], Location = "Parish hall",
            Description = "Isolated description", ImmediateActions = "Isolated action", Urgent = false
        }, default);

        f.AsAppointment(f.Other, handler.Id);
        Assert.Equal("NotTracked", (await service.NotificationOutcomeAsync(staff.Parish, receipt.Id, default)).Status);
        var assign = new IncidentActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await service.GetAsync(staff.Parish, receipt.Id, default)).Version, Action = "assign",
            HandlerAccountId = Guid.Parse(f.Other)
        };
        var assigned = await service.ActAsync(staff.Parish, receipt.Id, assign, default);
        Assert.Equal("Stored", assigned.NotificationOutcome?.Status);
        Assert.Equal("Stored", (await service.ActAsync(staff.Parish, receipt.Id, assign, default)).NotificationOutcome?.Status);
        AssertNoIdentifiers(assigned);
        // A note stages no notice, so its own response says none was needed rather than echoing the assignment.
        var note = await service.ActAsync(staff.Parish, receipt.Id, new IncidentActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await service.GetAsync(staff.Parish, receipt.Id, default)).Version, Action = "note", Text = "Isolated note"
        }, default);
        Assert.Equal("NotRequired", note.NotificationOutcome?.Status);
        Assert.Null((await service.GetAsync(staff.Parish, receipt.Id, default)).Value.NotificationOutcome);

        // The recorder account has no incidents.manage authority: its notice is kept Pending, never silently re-routed or marked Stored.
        var reassigned = await service.ActAsync(staff.Parish, receipt.Id, new IncidentActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await service.GetAsync(staff.Parish, receipt.Id, default)).Version, Action = "assign",
            HandlerAccountId = Guid.Parse(recorderAccount)
        }, default);
        Assert.Equal("Pending", reassigned.NotificationOutcome?.Status);
        Assert.Equal("Pending", (await service.NotificationOutcomeAsync(staff.Parish, receipt.Id, default)).Status);

        f.AsAppointment(recorderAccount, recorder.Id);
        await Assert.ThrowsAsync<DomainException>(() => service.NotificationOutcomeAsync(staff.Parish, receipt.Id, default));
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => service.NotificationOutcomeAsync(staff.Parish, receipt.Id, default));
        f.AsRecovery(f.Other);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => service.NotificationOutcomeAsync(staff.Parish, receipt.Id, default))).Code);
    }

    [Fact]
    public async Task Concern_notice_outcomes_reach_only_the_eligible_reviewer_never_the_submitter_or_outsiders()
    {
        await using var f = await StartAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var concerns = f.Services.GetRequiredService<ConcernService>();
        var reviewerAccount = await f.CreateVerifiedStaffAsync();
        var otherReviewerAccount = await f.CreateVerifiedStaffAsync();
        f.As(f.Nominee);
        var reviewer = await concerns.AppointReviewerAsync(staff.Organization, new AppointReviewerDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(reviewerAccount), Description = "Isolated reviewer", Categories = ["Safeguarding"],
            CanViewIdentity = false, EvidenceReference = "Isolated bishop decree"
        }, default);
        await concerns.AppointReviewerAsync(staff.Organization, new AppointReviewerDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(otherReviewerAccount), Description = "Unselected reviewer", Categories = ["Safeguarding"],
            CanViewIdentity = true, EvidenceReference = "Isolated bishop decree"
        }, default);

        var submitter = await f.CreateVerifiedMemberAsync();
        f.As(submitter, mfa: false);
        var concern = await concerns.SubmitAsync(staff.Parish, new SubmitConcernDto
        {
            OperationId = Guid.NewGuid(), Category = "Safeguarding", Urgency = "Normal", Summary = "Isolated concern", Details = "Isolated details",
            ReviewerIds = [reviewer.Id], Anonymous = true
        }, default);
        Assert.Null(concern.NotificationOutcome);

        f.As(reviewerAccount);
        Assert.Equal("NotTracked", (await concerns.NotificationOutcomeAsync(staff.Parish, concern.Id, default)).Status);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = staff.Parish };
        var accept = new ConcernActionDto { OperationId = Guid.NewGuid(), Version = (await records.ReadAsync<Concern>(scope, "concern:" + concern.Id, default))!.Version, Action = "accept" };
        var accepted = await concerns.ActAsync(staff.Parish, concern.Id, accept, default);
        Assert.Equal("Stored", accepted.NotificationOutcome?.Status);
        Assert.Equal("Stored", (await concerns.ActAsync(staff.Parish, concern.Id, accept, default)).NotificationOutcome?.Status);
        Assert.Null(accepted.SubmitterAccountId);
        AssertNoIdentifiers(accepted);
        var asked = await concerns.PostEntryAsync(staff.Parish, concern.Id, new PostConcernEntryDto { OperationId = Guid.NewGuid(), Kind = "InformationRequest", Body = "When?" }, default);
        Assert.Equal("Stored", asked.NotificationOutcome?.Status);
        var working = await concerns.PostEntryAsync(staff.Parish, concern.Id, new PostConcernEntryDto { OperationId = Guid.NewGuid(), Kind = "ReviewerNote", Body = "Working note" }, default);
        Assert.Equal("NotRequired", working.NotificationOutcome?.Status);
        Assert.Equal("Stored", (await concerns.EntryNotificationOutcomeAsync(staff.Parish, concern.Id, asked.Id, default)).Status);
        Assert.Equal("NotRequired", (await concerns.EntryNotificationOutcomeAsync(staff.Parish, concern.Id, working.Id, default)).Status);
        Assert.All(await concerns.EntriesAsync(staff.Parish, concern.Id, default), e => Assert.Null(e.NotificationOutcome));
        Assert.Null((await concerns.GetAsync(staff.Parish, concern.Id, default)).Value.NotificationOutcome);

        // The submitter's own projections never carry delivery diagnostics, and the diagnostic routes deny them.
        f.As(submitter, mfa: false);
        Assert.All(await concerns.EntriesAsync(staff.Parish, concern.Id, default), e => Assert.Null(e.NotificationOutcome));
        var reply = await concerns.PostEntryAsync(staff.Parish, concern.Id, new PostConcernEntryDto { OperationId = Guid.NewGuid(), Kind = "SubmitterMessage", Body = "Sunday" }, default);
        Assert.Null(reply.NotificationOutcome);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => concerns.NotificationOutcomeAsync(staff.Parish, concern.Id, default))).Kind);
        await Assert.ThrowsAsync<DomainException>(() => concerns.EntryNotificationOutcomeAsync(staff.Parish, concern.Id, asked.Id, default));

        // Unselected reviewers, office staff, the bishop and platform operators get no case, count or outcome signal.
        foreach (var outsider in new[] { otherReviewerAccount, f.Other, f.Nominee, f.FirstAdmin })
        {
            f.As(outsider);
            Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => concerns.NotificationOutcomeAsync(staff.Parish, concern.Id, default))).Kind);
            await Assert.ThrowsAsync<DomainException>(() => concerns.EntryNotificationOutcomeAsync(staff.Parish, concern.Id, asked.Id, default));
        }
        f.AsRecovery(reviewerAccount);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => concerns.NotificationOutcomeAsync(staff.Parish, concern.Id, default))).Code);
    }

    // Outcomes are a status and meaning only: no work IDs, recipient accounts, counts or topics leak through the serialized projection.
    private static void AssertNoIdentifiers(object projection)
    {
        var json = JsonSerializer.Serialize(projection);
        Assert.DoesNotContain("notificationWork", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("WorkIds", json, StringComparison.Ordinal);
        Assert.DoesNotContain("Recipient", json, StringComparison.Ordinal);
    }
}
