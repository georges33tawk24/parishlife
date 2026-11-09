// Purpose: verifies durable ministry membership intervals, safe departure cleanup and exact returned-information stages.
// Main tests: separate rejoin periods, stale all-or-nothing departure, archived-person cleanup, saved priest resume stage and explicit legacy-review denial.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryMembershipPeriodTests
{
    [Fact]
    public async Task Rejoin_creates_a_new_interval_without_rewriting_the_actual_prior_join_or_departure()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(group.Id, member.AccountId); await s.ApplicationActionAsync(group.Id, join.Id, "approve");
        var records = f.Services.GetRequiredService<IRecordTransactions>(); var scope = MinistryAccess.Scope(s.Parish);
        var first = (await records.ReadAsync<MinistryMembership>(scope, MinistryAccess.MemberKey(group.Id, member.PersonId), default))!;
        Assert.Equal(join.Id, first.Value.PeriodId);
        f.Clock.Now = f.Clock.Now.AddHours(1);
        var leave = await s.ApplyAsync(group.Id, member.AccountId, "Leave"); await s.ApplicationActionAsync(group.Id, leave.Id, "approve");
        var oldPeriod = (await records.ReadAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod:" + first.Value.PeriodId, default))!;
        Assert.Equal(first.Value.JoinedAt, oldPeriod.Value.JoinedAt); Assert.Equal(f.Clock.Now, oldPeriod.Value.LeftAt);
        Assert.Equal(join.Id, oldPeriod.Value.JoinApplicationId); Assert.Equal(leave.Id, oldPeriod.Value.LeaveApplicationId);
        f.Clock.Now = f.Clock.Now.AddHours(1);
        var secondJoin = await s.ApplyAsync(group.Id, member.AccountId); await s.ApplicationActionAsync(group.Id, secondJoin.Id, "approve");
        var current = (await records.ReadAsync<MinistryMembership>(scope, MinistryAccess.MemberKey(group.Id, member.PersonId), default))!;
        Assert.NotEqual(first.Value.PeriodId, current.Value.PeriodId); Assert.Equal(f.Clock.Now, current.Value.JoinedAt);
        Assert.Equal(oldPeriod.Version, (await records.ReadAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod:" + first.Value.PeriodId, default))!.Version);
        var periods = await records.CollectAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod", default,
            conditions: [new RecordCondition { Path = "ministryId", Comparison = "eq", Value = group.Id }]);
        Assert.Equal(2, periods.Count); Assert.Single(periods, row => row.Value.LeftAt is null);
    }

    [Fact]
    public async Task Stale_departure_cannot_end_membership_period_or_leadership_then_valid_decision_updates_all_three()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync(true);
        var join = await s.ApplyAsync(group.Id, member.AccountId); await s.ApplicationActionAsync(group.Id, join.Id, "approve"); s.Use();
        var leadership = f.Services.GetRequiredService<MinistryLeadershipService>();
        await leadership.AppointAsync(s.Parish, group.Id, new AppointLeaderDto
        { OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, group.Id, default)).Version,
            AccountId = Guid.Parse(member.AccountId), Role = "Leader", StartsAt = f.Clock.Now, EvidenceReference = "Actual isolated leader appointment" }, default);
        f.Clock.Now = f.Clock.Now.AddHours(1); var leave = await s.ApplyAsync(group.Id, member.AccountId, "Leave"); s.Use();
        var request = new ApplicationActionDto { OperationId = Guid.NewGuid(), Version = "stale", Action = "approve" };
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => s.Applications.ActAsync(s.Parish, group.Id, leave.Id, request, default))).Code);
        var records = f.Services.GetRequiredService<IRecordTransactions>(); var scope = MinistryAccess.Scope(s.Parish);
        Assert.Null((await records.ReadAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod:" + join.Id, default))!.Value.LeftAt);
        Assert.True((await leadership.GetAsync(s.Parish, group.Id, member.AccountId, default)).Value.Effective);
        request.Version = (await s.Applications.GetAsync(s.Parish, group.Id, leave.Id, default)).Version;
        await s.Applications.ActAsync(s.Parish, group.Id, leave.Id, request, default);
        Assert.Equal(f.Clock.Now, (await records.ReadAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod:" + join.Id, default))!.Value.LeftAt);
        Assert.False((await leadership.GetAsync(s.Parish, group.Id, member.AccountId, default)).Value.Effective);
        Assert.False(Assert.Single((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items).Current);
    }

    [Fact]
    public async Task Archived_person_does_not_trap_an_existing_private_departure_or_restore_leadership()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(group.Id, member.AccountId); await s.ApplicationActionAsync(group.Id, join.Id, "approve");
        f.Clock.Now = f.Clock.Now.AddHours(1); var leave = await s.ApplyAsync(group.Id, member.AccountId, "Leave"); s.Use();
        var people = f.Services.GetRequiredService<PeopleService>(); var person = await people.GetAsync(s.Parish, member.PersonId, default);
        await people.SetArchiveAsync(s.Parish, member.PersonId, new ArchivePersonDto
        { OperationId = Guid.NewGuid(), Version = person.Version, Archived = true }, default);
        Assert.Equal("Approved", (await s.ApplicationActionAsync(group.Id, leave.Id, "approve")).Status); s.Use();
        Assert.False(Assert.Single((await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items).Current);
        f.As(member.AccountId, false);
        Assert.Equal("Approved", (await s.Applications.GetAsync(s.Parish, group.Id, leave.Id, default)).Value.Status);
    }

    [Fact]
    public async Task Priest_return_for_information_resumes_actual_saved_stage_without_manufacturing_a_new_leader_review()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(group.Id, member.AccountId);
        var reviewed = await s.ApplicationActionAsync(group.Id, join.Id, "recommend");
        var returned = await s.ApplicationActionAsync(group.Id, join.Id, "return");
        Assert.Equal("Returned", returned.Status); Assert.NotNull(returned.Reason);
        f.As(member.AccountId, false);
        var row = await s.Applications.GetAsync(s.Parish, group.Id, join.Id, default);
        var resumed = await s.Applications.ActAsync(s.Parish, group.Id, join.Id,
            new ApplicationActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "resubmit" }, default);
        Assert.Equal("AwaitingPriest", resumed.Status); Assert.Equal(reviewed.RecommendedAt, resumed.RecommendedAt);
        Assert.Equal("Approved", (await s.ApplicationActionAsync(group.Id, join.Id, "approve")).Status);
    }

    [Fact]
    public async Task Legacy_membership_without_period_cannot_be_silently_replaced_by_rejoin()
    {
        await using var f = new LocalBackendFixture(); await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f); var group = await s.MinistryAsync(); var member = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(group.Id, member.AccountId); await s.ApplicationActionAsync(group.Id, join.Id, "approve");
        f.Clock.Now = f.Clock.Now.AddHours(1); var leave = await s.ApplyAsync(group.Id, member.AccountId, "Leave");
        await s.ApplicationActionAsync(group.Id, leave.Id, "approve");
        var records = f.Services.GetRequiredService<IRecordTransactions>(); var scope = MinistryAccess.Scope(s.Parish);
        var key = MinistryAccess.MemberKey(group.Id, member.PersonId); var old = (await records.ReadAsync<MinistryMembership>(scope, key, default))!;
        old.Value.PeriodId = string.Empty;
        await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), f.Other, new { legacy = key }, f.Clock), "fixture.legacy", member.PersonId,
            [RecordChange.Replace(key, "ministryMembership", old.Value, old.Version)], new CommandResult { Id = member.PersonId, Status = "Legacy" }, default);
        f.Clock.Now = f.Clock.Now.AddHours(1); var rejoin = await s.ApplyAsync(group.Id, member.AccountId);
        Assert.Equal("invalid_ministry_state", (await Assert.ThrowsAsync<DomainException>(() => s.ApplicationActionAsync(group.Id, rejoin.Id, "approve"))).Code);
        Assert.Empty((await records.CollectAsync<MinistryMembershipPeriod>(scope, "ministryMembershipPeriod", default)).Where(row => row.Value.LeftAt is null));
    }
}
