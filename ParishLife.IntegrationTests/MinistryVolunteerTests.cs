// Purpose: verifies ministry volunteering (S20) through real local services and storage.
// Main tests: signup and invitation need coordinator confirmation within capacity and without overlapping duties; cancellation keeps
// the commitment until a coordinator releases it; actual hours need independent review and keep corrected originals; duty boundaries.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryVolunteerTests
{
    private sealed record Setup(LocalBackendFixture F, MinistryScenario S, string Ministry, string Coordinator,
        (string AccountId, string PersonId, string Username) First, (string AccountId, string PersonId, string Username) Second)
    {
        public MinistryVolunteerService Service => F.Services.GetRequiredService<MinistryVolunteerService>();
        public string Parish => S.Parish;
    }

    [Fact]
    public async Task Confirmation_respects_capacity_overlap_and_coordinator_release_of_cancelled_duties()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var start = f.Clock.Now.AddDays(1);
        var choir = await OpportunityAsync(x, start, start.AddHours(2), capacity: 1);

        f.As(x.First.AccountId, mfa: false);
        var sheet = Assert.Single((await x.Service.OpenOpportunitiesAsync(x.Parish, x.Ministry, 25, null, default)).Items).Value;
        Assert.Equal(1, sheet.Remaining);
        var signup = await x.Service.InviteAsync(x.Parish, x.Ministry, choir.Id, new InviteVolunteerDto { OperationId = Guid.NewGuid() }, default);
        Assert.Equal(("AwaitingConfirmation", "Coordinator", "Signup"), (signup.Status, signup.NextActor, signup.Origin));
        Assert.Null(signup.CreatedBy);

        f.As(x.Coordinator);
        var invite = await InviteAsync(x, choir.Id, x.Second.PersonId);
        Assert.Equal(("Invited", "Volunteer"), (invite.Status, invite.NextActor));
        f.As(x.First.AccountId, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, invite.Id, "accept"));
        f.As(x.Second.AccountId, mfa: false);
        await ActAsync(x, invite.Id, "accept");

        f.As(x.Coordinator);
        Assert.Equal("Confirmed", (await ActAsync(x, signup.Id, "confirm")).Status);
        Assert.Equal("invalid_volunteer_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, invite.Id, "confirm"))).Code);

        var overlapping = await OpportunityAsync(x, start.AddMinutes(30), start.AddHours(1), capacity: 2);
        f.As(x.Coordinator);
        var second = await InviteAsync(x, overlapping.Id, x.First.PersonId);
        f.As(x.First.AccountId, mfa: false);
        await ActAsync(x, second.Id, "accept");
        f.As(x.Coordinator);
        Assert.Equal("invalid_volunteer_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, second.Id, "confirm"))).Code);

        f.As(x.First.AccountId, mfa: false);
        Assert.Equal("CancellationRequested", (await ActAsync(x, signup.Id, "request-cancel", "Family commitment")).Status);
        f.As(x.Coordinator);
        Assert.Equal(0, await RemainingAsync(x, choir.Id));
        Assert.Equal("Cancelled", (await ActAsync(x, signup.Id, "approve-cancel")).Status);
        Assert.Equal(1, await RemainingAsync(x, choir.Id));
        Assert.Equal("Confirmed", (await ActAsync(x, invite.Id, "confirm")).Status);
        Assert.Equal("Confirmed", (await ActAsync(x, second.Id, "confirm")).Status);
        Assert.Equal(2, (await x.Service.TeamAsync(x.Parish, x.Ministry, choir.Id, 25, null, default)).Items.Count);
    }

    [Fact]
    public async Task Actual_hours_need_an_independent_reviewer_and_corrections_keep_the_submitted_values()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var start = f.Clock.Now.AddDays(1);
        var slot = await OpportunityAsync(x, start, start.AddHours(2), capacity: 2);
        var first = await ConfirmedAsync(x, slot.Id, x.First);
        var second = await ConfirmedAsync(x, slot.Id, x.Second);
        f.As(x.Coordinator);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, first.Id, "complete"));

        f.Clock.Now = start.AddHours(3);
        await ActAsync(x, first.Id, "complete");
        f.As(x.First.AccountId, mfa: false);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => SubmitAsync(x, first.Id, start, start.AddHours(4), 0))).Code);
        var hours = await SubmitAsync(x, first.Id, start, start.AddHours(2), 15);
        Assert.Equal(105, hours.Minutes);
        await Assert.ThrowsAsync<DomainException>(() => SubmitAsync(x, first.Id, start, start.AddHours(1), 0));

        f.As(x.Coordinator);
        var corrected = await HoursActionAsync(x, first.Id, "correct", start, start.AddHours(1), 0, "Left after the first hour per sign-out sheet");
        Assert.Equal(("Verified", 60), (corrected.Status, corrected.Minutes));
        Assert.Equal(start.AddHours(2), corrected.OriginalEndsAt);

        // The coordinator who submits hours for someone cannot also verify them.
        var proxy = await SubmitAsync(x, second.Id, start, start.AddHours(2), 0);
        Assert.Equal("invalid_volunteer_state", (await Assert.ThrowsAsync<DomainException>(() => HoursActionAsync(x, second.Id, "verify"))).Code);
        x.S.Use();
        Assert.Equal("Rejected", (await HoursActionAsync(x, second.Id, "reject", reason: "No sign-in record")).Status);
        Assert.Equal(proxy.SubmittedBy, x.Coordinator);

        f.As(x.First.AccountId, mfa: false);
        var own = Assert.Single((await x.Service.OwnHoursAsync(x.Parish, x.Ministry, 25, null, default)).Items).Value;
        Assert.Null(own.ReviewedBy);
        Assert.Equal(60, own.Minutes);
    }

    [Fact]
    public async Task Coordination_is_an_explicit_duty_and_signup_is_limited_to_current_members()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var start = f.Clock.Now.AddDays(1);
        var slot = await OpportunityAsync(x, start, start.AddHours(1), capacity: 1);

        var plain = await f.CreateVerifiedStaffAsync();
        await AppointAsync(x.S, x.Ministry, plain, null);
        f.As(plain);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.ListOpportunitiesAsync(x.Parish, x.Ministry, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => InviteAsync(x, slot.Id, x.First.PersonId));

        var outsider = await x.S.LinkedApplicantAsync();
        f.As(outsider.AccountId, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.OpenOpportunitiesAsync(x.Parish, x.Ministry, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.InviteAsync(x.Parish, x.Ministry, slot.Id, new InviteVolunteerDto { OperationId = Guid.NewGuid() }, default));
        f.As(x.Coordinator);
        Assert.Equal("invalid_volunteer_state", (await Assert.ThrowsAsync<DomainException>(() => InviteAsync(x, slot.Id, outsider.PersonId))).Code);

        var limited = await MinistryScenario.CreateAsync(f);
        var group = await limited.MinistryAsync();
        var candidate = await f.CreateVerifiedStaffAsync();
        await Assert.ThrowsAsync<DomainException>(() => AppointAsync(limited, group.Id, candidate, "volunteers.coordinate"));
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesVolunteersManage]);
        var group = await s.MinistryAsync();
        var first = await JoinAsync(s, group.Id);
        var second = await JoinAsync(s, group.Id);
        var coordinator = await f.CreateVerifiedStaffAsync();
        await AppointAsync(s, group.Id, coordinator, "volunteers.coordinate");
        return new Setup(f, s, group.Id, coordinator, first, second);
    }

    private static async Task<(string AccountId, string PersonId, string Username)> JoinAsync(MinistryScenario s, string ministry)
    {
        var member = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(ministry, member.AccountId);
        await s.ApplicationActionAsync(ministry, join.Id, "approve");
        return member;
    }

    private static async Task AppointAsync(MinistryScenario s, string ministry, string account, string? duty)
    {
        s.Use();
        await s.Fixture.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, ministry, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, ministry, default)).Version,
            AccountId = Guid.Parse(account), Role = "Leader", Duties = duty is null ? [] : [duty], StartsAt = s.Fixture.Clock.Now,
            EvidenceReference = "Isolated coordination appointment"
        }, default);
    }

    private static async Task<VolunteerOpportunityDto> OpportunityAsync(Setup x, DateTimeOffset start, DateTimeOffset end, int capacity)
    {
        x.F.As(x.Coordinator);
        var item = await x.Service.CreateOpportunityAsync(x.Parish, x.Ministry, new SaveOpportunityDto
        {
            OperationId = Guid.NewGuid(), Title = "Isolated choir service", Position = "Cantor", StartsAt = start, EndsAt = end,
            Capacity = capacity, SelfSignup = true
        }, default);
        return await x.Service.OpportunityActionAsync(x.Parish, x.Ministry, item.Id, new OpportunityActionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<VolunteerOpportunity>(x, "volunteerOpportunity:" + item.Id), Action = "open"
        }, default);
    }

    private static Task<VolunteerAssignmentDto> InviteAsync(Setup x, string opportunity, string person)
        => x.Service.InviteAsync(x.Parish, x.Ministry, opportunity, new InviteVolunteerDto { OperationId = Guid.NewGuid(), PersonId = Guid.Parse(person) }, default);

    private static async Task<VolunteerAssignmentDto> ConfirmedAsync(Setup x, string opportunity, (string AccountId, string PersonId, string Username) member)
    {
        x.F.As(x.Coordinator);
        var invite = await InviteAsync(x, opportunity, member.PersonId);
        x.F.As(member.AccountId, mfa: false);
        await ActAsync(x, invite.Id, "accept");
        x.F.As(x.Coordinator);
        return await ActAsync(x, invite.Id, "confirm");
    }

    private static async Task<VolunteerAssignmentDto> ActAsync(Setup x, string assignment, string action, string? reason = null)
        => await x.Service.ActAsync(x.Parish, x.Ministry, assignment, new AssignmentActionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<VolunteerAssignment>(x, "volunteerAssignment:" + assignment), Action = action, Reason = reason
        }, default);

    private static Task<VolunteerHoursDto> SubmitAsync(Setup x, string assignment, DateTimeOffset start, DateTimeOffset end, int pause)
        => x.Service.SubmitHoursAsync(x.Parish, x.Ministry, assignment, new SubmitHoursDto
        {
            OperationId = Guid.NewGuid(), StartsAt = start, EndsAt = end, BreakMinutes = pause, EvidenceReference = "Isolated sign-in sheet"
        }, default);

    private static async Task<VolunteerHoursDto> HoursActionAsync(Setup x, string assignment, string action, DateTimeOffset? start = null,
        DateTimeOffset? end = null, int? pause = null, string? reason = null)
        => await x.Service.HoursActionAsync(x.Parish, x.Ministry, assignment, new HoursActionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<VolunteerHours>(x, "volunteerHours:" + assignment), Action = action,
            StartsAt = start, EndsAt = end, BreakMinutes = pause, Reason = reason
        }, default);

    private static async Task<int> RemainingAsync(Setup x, string opportunity)
    {
        var row = (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<VolunteerOpportunity>(MinistryAccess.Scope(x.Parish), "volunteerOpportunity:" + opportunity, default))!;
        return row.Value.Capacity - row.Value.Confirmed;
    }

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync<T>(Setup x, string key)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<T>(MinistryAccess.Scope(x.Parish), key, default))!.Version;
}
