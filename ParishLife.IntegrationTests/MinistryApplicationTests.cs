// Purpose: verifies ministry application state, scoped review, atomic roster transitions, protected reasons and cleanup after coverage lapse.
// Main tests: review/withdrawal, duplicate/stale races, private departure and leadership termination, assisted provenance and policy/link rechecks.

using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryApplicationTests
{
    [Fact]
    public async Task Direct_priest_approval_has_no_fictional_leader_review_and_duplicate_requests_never_duplicate_roster()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var application = await s.ApplyAsync(group.Id, member.AccountId);
        f.As(member.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.ApplyAsync(s.Parish, group.Id, new ApplyMinistryDto { OperationId = Guid.NewGuid(), Kind = "Join" }, default));
        var approved = await s.ApplicationActionAsync(group.Id, application.Id, "approve");
        Assert.Equal("Approved", approved.Status); Assert.Null(approved.ReviewedAt); Assert.Null(approved.RecommendedAt);
        s.Use(); var roster = await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default);
        Assert.True(Assert.Single(roster.Items).Current);
        f.As(member.AccountId, false);
        Assert.True((await s.Applications.OwnMembershipAsync(s.Parish, group.Id, default)).Current);
        Assert.Single((await s.Applications.OwnAsync(s.Parish, group.Id, 25, null, default)).Items);
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default));
    }

    [Fact]
    public async Task Assigned_leader_review_is_scoped_independent_and_returned_unreviewed_request_withdraws_immediately()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var otherGroup = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync(); var leader = await s.LinkedApplicantAsync(true);
        await Appoint(s, group.Id, leader.AccountId);
        var app = await s.ApplyAsync(group.Id, member.AccountId);
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.ListAsync(s.Parish, group.Id, "Join", 25, null, default));
        f.As(leader.AccountId);
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.ListAsync(s.Parish, otherGroup.Id, "Join", 25, null, default));
        var returned = await Act(s, group.Id, app.Id, "return", leader.AccountId, "Please supply the actual prerequisite evidence.");
        Assert.Equal("Returned", returned.Status); Assert.Null(returned.RecommendedAt); Assert.NotNull(returned.ReviewedAt);
        var withdrawn = await Act(s, group.Id, app.Id, "withdraw", member.AccountId);
        Assert.Equal("Withdrawn", withdrawn.Status);
        s.Use();
        var terminalVersion = (await s.Applications.GetAsync(s.Parish, group.Id, app.Id, default)).Version;
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.ActAsync(s.Parish, group.Id, app.Id, new ApplicationActionDto
        { OperationId = Guid.NewGuid(), Version = terminalVersion, Action = "approve", EligibilityReviewReference = "review" }, default));
        var newApp = await s.ApplyAsync(group.Id, member.AccountId);
        Assert.NotEqual(app.Id, newApp.Id);
        var leaderOwn = await s.ApplyAsync(group.Id, leader.AccountId);
        f.As(leader.AccountId);
        var ownRow = await s.Applications.GetAsync(s.Parish, group.Id, leaderOwn.Id, default);
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.ActAsync(s.Parish, group.Id, leaderOwn.Id,
            new ApplicationActionDto { OperationId = Guid.NewGuid(), Version = ownRow.Version, Action = "recommend" }, default));
    }

    [Fact]
    public async Task Reviewed_withdrawal_preserves_previous_stage_and_repeated_request_cannot_corrupt_it()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var app = await s.ApplyAsync(group.Id, member.AccountId);
        await s.ApplicationActionAsync(group.Id, app.Id, "recommend");
        Assert.Equal("WithdrawalRequested", (await Act(s, group.Id, app.Id, "withdraw", member.AccountId)).Status);
        await Assert.ThrowsAsync<DomainException>(() => Act(s, group.Id, app.Id, "withdraw", member.AccountId));
        Assert.Equal("AwaitingPriest", (await s.ApplicationActionAsync(group.Id, app.Id, "deny-withdrawal")).Status);
        await Act(s, group.Id, app.Id, "withdraw", member.AccountId);
        Assert.Equal("Withdrawn", (await s.ApplicationActionAsync(group.Id, app.Id, "approve-withdrawal")).Status);
        s.Use(); Assert.Empty((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items);
    }

    [Fact]
    public async Task Stale_decision_rolls_back_membership_guard_and_history_then_exact_retry_returns_current_state()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var app = await s.ApplyAsync(group.Id, member.AccountId); s.Use();
        var request = new ApplicationActionDto { OperationId = Guid.NewGuid(), Version = "stale", Action = "approve", EligibilityReviewReference = "private actual evidence" };
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => s.Applications.ActAsync(s.Parish, group.Id, app.Id, request, default))).Code);
        Assert.Empty((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items);
        Assert.Single((await s.Applications.HistoryAsync(s.Parish, group.Id, app.Id, 25, null, default)).Items);
        request.Version = (await s.Applications.GetAsync(s.Parish, group.Id, app.Id, default)).Version;
        await s.Applications.ActAsync(s.Parish, group.Id, app.Id, request, default);
        Assert.Equal("Approved", (await s.Applications.ActAsync(s.Parish, group.Id, app.Id, request, default)).Status);
        Assert.Single((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items);
        var metadata = await Metadata(s);
        Assert.DoesNotContain(request.EligibilityReviewReference!, metadata);
        Assert.Equal(request.EligibilityReviewReference, (await s.Applications.EvidenceAsync(s.Parish, group.Id, app.Id, default)).EligibilityReviewReference);
    }

    [Fact]
    public async Task Competing_final_decisions_have_one_winner_and_no_partial_roster_or_history()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var app = await s.ApplyAsync(group.Id, member.AccountId); s.Use();
        var version = (await s.Applications.GetAsync(s.Parish, group.Id, app.Id, default)).Version;
        async Task<string> Decide(string action)
        {
            try
            {
                await s.Applications.ActAsync(s.Parish, group.Id, app.Id, new ApplicationActionDto
                { OperationId = Guid.NewGuid(), Version = version, Action = action, EligibilityReviewReference = "actual reviewed basis", Reason = "Applicant-safe explanation" }, default);
                return action;
            }
            catch (DomainException e) when (e.Kind == FailureKind.Conflict) { return "conflict"; }
        }
        var results = await Task.WhenAll(Decide("approve"), Decide("decline"));
        Assert.Single(results, x => x == "conflict");
        var current = (await s.Applications.GetAsync(s.Parish, group.Id, app.Id, default)).Value;
        var roster = await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default);
        Assert.Equal(current.Status == "Approved" ? 1 : 0, roster.Items.Count);
        Assert.Equal(2, (await s.Applications.HistoryAsync(s.Parish, group.Id, app.Id, 25, null, default)).Items.Count);
    }

    [Fact]
    public async Task Departure_remains_private_until_neutral_end_and_ends_linked_leadership_atomically()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync(true);
        var app = await s.ApplyAsync(group.Id, member.AccountId); await s.ApplicationActionAsync(group.Id, app.Id, "approve");
        await Appoint(s, group.Id, member.AccountId);
        var leave = await s.ApplyAsync(group.Id, member.AccountId, "Leave");
        f.As(member.AccountId);
        var service = f.Services.GetRequiredService<MinistryDepartureService>();
        var request = new PrivateDepartureReasonDto { OperationId = Guid.NewGuid(), Reason = "Very private isolated departure reason" };
        await service.SaveAsync(s.Parish, group.Id, leave.Id, request, default);
        Assert.Equal(request.Reason, (await service.SaveAsync(s.Parish, group.Id, leave.Id, request, default)).Reason);
        s.Use(); Assert.True(Assert.Single((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items).Current);
        Assert.True((await f.Services.GetRequiredService<MinistryLeadershipService>().GetAsync(s.Parish, group.Id, member.AccountId, default)).Value.Effective);
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Parish, group.Id, leave.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.ListAsync(s.Parish, group.Id, "Leave", 25, null, default));
        await s.ApplicationActionAsync(group.Id, leave.Id, "approve"); s.Use();
        var roster = Assert.Single((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items);
        Assert.False(roster.Current); Assert.NotNull(roster.LeftAt);
        Assert.False((await f.Services.GetRequiredService<MinistryLeadershipService>().GetAsync(s.Parish, group.Id, member.AccountId, default)).Value.Effective);
        Assert.Contains((await f.Services.GetRequiredService<MinistryLeadershipService>().HistoryAsync(s.Parish, group.Id, member.AccountId, 25, null, default)).Items, row => row.Action == "Ended");
        var files = string.Join("\n", Directory.EnumerateFiles(f.DirectoryPath, "*.json", SearchOption.AllDirectories).Select(File.ReadAllText));
        Assert.DoesNotContain(request.Reason, files);
        Assert.DoesNotContain(request.Reason, await Metadata(s));
        f.As(member.AccountId);
        Assert.Equal(request.Reason, (await service.GetAsync(s.Parish, group.Id, leave.Id, default)).Value.Reason);
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Parish, group.Id, leave.Id, new PrivateDepartureReasonDto
        { OperationId = Guid.NewGuid(), Reason = "Attempt to rewrite finalized history" }, default));
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default));
    }

    [Fact]
    public async Task Assisted_join_retains_provenance_and_independent_review_without_a_private_departure_backdoor()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        f.As(f.FirstAdmin);
        var request = new ApplyMinistryDto { OperationId = Guid.NewGuid(), Kind = "Join", PersonId = Guid.Parse(member.PersonId), RepresentationEvidence = "Actual isolated consent instruction" };
        var app = await s.Applications.ApplyAsync(s.Parish, group.Id, request, default);
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => s.Applications.ApplyAsync(s.Parish, group.Id,
            new ApplyMinistryDto { OperationId = Guid.NewGuid(), Kind = "Leave", PersonId = Guid.Parse(member.PersonId), RepresentationEvidence = "must not grant private leave access" }, default));
        s.Use(); Assert.Equal(request.RepresentationEvidence, (await s.Applications.EvidenceAsync(s.Parish, group.Id, app.Id, default)).RepresentationEvidence);
        await s.ApplicationActionAsync(group.Id, app.Id, "approve"); s.Use();
        Assert.True(Assert.Single((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items).Current);
        var files = string.Join("\n", Directory.EnumerateFiles(f.DirectoryPath, "*.json", SearchOption.AllDirectories).Select(File.ReadAllText));
        Assert.DoesNotContain(request.RepresentationEvidence!, files);
    }

    [Fact]
    public async Task Changed_policy_or_archived_person_cannot_be_silently_approved()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var app = await s.ApplyAsync(group.Id, member.AccountId);
        await s.ActAsync(group.Id, "archive"); await s.ActAsync(group.Id, "restore"); s.Use();
        var row = await s.Ministries.GetAsync(s.Parish, group.Id, default);
        await s.Ministries.SaveAsync(s.Parish, group.Id, new SaveMinistryDto { OperationId = Guid.NewGuid(), Version = row.Version,
            Name = group.Name, Kind = group.Kind, Purpose = group.Purpose, EligibilityPolicyReference = "Revised actual policy" }, default);
        await s.ActAsync(group.Id, "approve"); await s.ActAsync(group.Id, "open-applications");
        await Assert.ThrowsAsync<DomainException>(() => s.ApplicationActionAsync(group.Id, app.Id, "approve"));
        await s.ApplicationActionAsync(group.Id, app.Id, "return"); await Act(s, group.Id, app.Id, "resubmit", member.AccountId);
        s.Use(); var records = f.Services.GetRequiredService<IRecordTransactions>(); var scope = MinistryAccess.Scope(s.Parish);
        var person = (await records.ReadAsync<Person>(scope, "person:" + member.PersonId, default))!; person.Value.Archived = true;
        await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), f.Other, new { archive = member.PersonId }, f.Clock), "fixture.archive", member.PersonId,
            [RecordChange.Replace("person:" + member.PersonId, "person", person.Value, person.Version)], new CommandResult { Id = member.PersonId, Status = "Archived" }, default);
        await Assert.ThrowsAsync<DomainException>(() => s.ApplicationActionAsync(group.Id, app.Id, "approve")); s.Use();
        Assert.Empty((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items);
    }

    [Fact]
    public async Task Module_lapse_preserves_in_flight_decision_history_and_departure_but_blocks_new_join()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var app = await s.ApplyAsync(group.Id, member.AccountId);
        var records = f.Services.GetRequiredService<IRecordTransactions>(); var scope = MinistryAccess.Scope(s.Parish);
        var coverages = await records.PageAsync<Coverage>(scope, "coverage", 100, null, default);
        Assert.NotEmpty(coverages.Items);
        foreach (var coverage in coverages.Items)
        {
            coverage.Value.EndsAt = f.Clock.Now;
            await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), f.FirstAdmin, new { end = coverage.Value.Id }, f.Clock), "fixture.coverage_end", coverage.Value.Id,
                [RecordChange.Replace("coverage:" + coverage.Value.Id, "coverage", coverage.Value, coverage.Version)], new CommandResult { Id = coverage.Value.Id, Status = "Ended" }, default);
        }
        await s.ApplicationActionAsync(group.Id, app.Id, "approve");
        var leave = await s.ApplyAsync(group.Id, member.AccountId, "Leave");
        await s.ApplicationActionAsync(group.Id, leave.Id, "approve");
        await Assert.ThrowsAsync<DomainException>(() => s.ApplyAsync(group.Id, member.AccountId));
        s.Use(); Assert.Equal("Approved", (await s.Applications.GetAsync(s.Parish, group.Id, leave.Id, default)).Value.Status);
    }

    private static async Task Appoint(MinistryScenario s, string ministry, string account)
    {
        s.Use(); var row = await s.Ministries.GetAsync(s.Parish, ministry, default);
        await s.Fixture.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, ministry, new AppointLeaderDto
        { OperationId = Guid.NewGuid(), MinistryVersion = row.Version, AccountId = Guid.Parse(account), Role = "Leader", StartsAt = s.Fixture.Clock.Now, EvidenceReference = "Actual isolated appointment evidence" }, default);
    }
    private static async Task<MinistryApplicationDto> Act(MinistryScenario s, string ministry, string application, string action, string account, string? reason = null)
    {
        s.Fixture.As(account); var row = await s.Applications.GetAsync(s.Parish, ministry, application, default);
        return await s.Applications.ActAsync(s.Parish, ministry, application, new ApplicationActionDto
        { OperationId = Guid.NewGuid(), Version = row.Version, Action = action, Reason = reason }, default);
    }
    private static async Task<string> Metadata(MinistryScenario s)
    {
        var records = s.Fixture.Services.GetRequiredService<IRecordTransactions>();
        return JsonSerializer.Serialize(new { Receipts = (await records.PageAsync<JsonElement>(MinistryAccess.Scope(s.Parish), "operation", 100, null, default)).Items,
            Audit = (await records.PageAsync<JsonElement>(MinistryAccess.Scope(s.Parish), "audit", 100, null, default)).Items });
    }
}
