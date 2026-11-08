// Purpose: exercises first-bishop authority against the real isolated backend, Identity store, and conditional local document transactions.
// Main tests: independent review/acceptance/effective dates, unrelated-account denial, stale-write rollback,
// expired/rejected/declined invitations, competing seat claims, and immediate account/MFA enforcement.

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class BishopAppointmentTests
{
    [Fact]
    public async Task Appointment_requires_independent_review_nominee_acceptance_and_effective_dates()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var organization = await fixture.OrganizationAsync();
        var service = fixture.Services.GetRequiredService<BishopAppointmentService>();
        var authority = fixture.Services.GetRequiredService<IArchdioceseAuthority>();
        var proposed = await fixture.ProposeAsync(organization, fixture.Clock.Now.AddHours(2));
        fixture.As(fixture.FirstAdmin);
        Assert.Equal("PendingReview", proposed.Status);
        Assert.False(proposed.IsEffective(fixture.Clock.Now));
        await Assert.ThrowsAsync<DomainException>(() => authority.RequireBishopAsync(organization, default));

        var row = await service.GetAsync(organization, proposed.Id, default);
        Assert.NotNull(row.Value.EvidenceReference);
        var independent = await Assert.ThrowsAsync<DomainException>(() => service.ReviewAsync(organization, proposed.Id,
            new ReviewBishopAppointmentDto { OperationId = Guid.NewGuid(), Version = row.Version, Approve = true, Reason = "Self review is forbidden" }, default));
        Assert.Equal("independent_review_required", independent.Code);

        await fixture.ReviewAsync(organization, proposed.Id);
        fixture.As(fixture.Nominee);
        row = await service.GetAsync(organization, proposed.Id, default);
        Assert.Null(row.Value.EvidenceReference);
        Assert.False(row.Value.Effective);
        Assert.Equal("Invited", row.Value.Status);
        await Assert.ThrowsAsync<DomainException>(() => authority.RequireBishopAsync(organization, default));
        var decision = new DecideBishopInvitationDto { OperationId = Guid.NewGuid(), Version = row.Version, Accept = true };
        var accepted = await service.DecideAsync(organization, proposed.Id, decision, default);
        Assert.Equal("Accepted", accepted.Status);
        Assert.Equal(accepted.Id, (await service.DecideAsync(organization, proposed.Id, decision, default)).Id);
        decision.Accept = false;
        Assert.Equal("operation_reused", (await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(organization, proposed.Id, decision, default))).Code);
        await Assert.ThrowsAsync<DomainException>(() => authority.RequireBishopAsync(organization, default));

        fixture.Clock.Now = fixture.Clock.Now.AddHours(2);
        await authority.RequireBishopAsync(organization, default);
        await Assert.ThrowsAsync<DomainException>(() => authority.RequireBishopAsync(Guid.NewGuid().ToString("N"), default));
        fixture.Clock.Now = proposed.ReviewDueAt!.Value;
        Assert.True((await service.GetAsync(organization, proposed.Id, default)).Value.ReviewOverdue);
        await authority.RequireBishopAsync(organization, default);
        fixture.Clock.Now = proposed.EndsAt!.Value;
        Assert.False((await service.GetAsync(organization, proposed.Id, default)).Value.Effective);
        await Assert.ThrowsAsync<DomainException>(() => authority.RequireBishopAsync(organization, default));
    }

    [Fact]
    public async Task Unrelated_accounts_cannot_read_or_accept_an_invitation_or_establish_an_archdiocese()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var organization = await fixture.OrganizationAsync();
        var proposal = await fixture.ProposeAsync(organization);
        await fixture.ReviewAsync(organization, proposal.Id);
        var service = fixture.Services.GetRequiredService<BishopAppointmentService>();
        fixture.As(fixture.Other);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(organization, proposal.Id, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(organization, proposal.Id,
            new DecideBishopInvitationDto { OperationId = Guid.NewGuid(), Version = "unknown", Accept = true }, default))).Kind);
        Assert.Equal("operator_required", (await Assert.ThrowsAsync<DomainException>(() => fixture.Services.GetRequiredService<ParishService>().RegisterArchdioceseAsync(
            new RegisterArchdioceseDto { OperationId = Guid.NewGuid(), Name = "Unauthorized fixture", Locality = "Fixture" }, default))).Code);
        fixture.As(fixture.FirstAdmin, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => service.ProposeAsync(organization, new ProposeBishopAppointmentDto(), default));
    }

    [Fact]
    public async Task A_stale_review_changes_neither_the_proposal_nor_its_organization_fence()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var organization = await fixture.OrganizationAsync();
        var proposal = await fixture.ProposeAsync(organization);
        fixture.As(fixture.SecondAdmin);
        var service = fixture.Services.GetRequiredService<BishopAppointmentService>();
        var organizations = fixture.Services.GetRequiredService<IParishRepository>();
        var before = (await organizations.GetArchdioceseAsync(organization, default))!;
        var error = await Assert.ThrowsAsync<DomainException>(() => service.ReviewAsync(organization, proposal.Id,
            new ReviewBishopAppointmentDto { OperationId = Guid.NewGuid(), Version = "stale", Approve = true, Reason = "Fixture review" }, default));
        Assert.Equal("write_conflict", error.Code);
        var untouched = await service.GetAsync(organization, proposal.Id, default);
        Assert.Equal("PendingReview", untouched.Value.Status);
        Assert.Null(untouched.Value.ReviewedBy);
        Assert.Equal(before.Version, (await organizations.GetArchdioceseAsync(organization, default))!.Version);
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("rejected")]
    [InlineData("declined")]
    public async Task Inactive_invitations_never_claim_the_bishop_seat(string outcome)
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var organization = await fixture.OrganizationAsync();
        var proposal = await fixture.ProposeAsync(organization);
        await fixture.ReviewAsync(organization, proposal.Id, approve: outcome != "rejected");
        fixture.As(fixture.Nominee);
        var service = fixture.Services.GetRequiredService<BishopAppointmentService>();
        var row = await service.GetAsync(organization, proposal.Id, default);
        if (outcome == "expired")
            fixture.Clock.Now = proposal.AcceptBy;
        if (outcome == "declined")
        {
            await service.DecideAsync(organization, proposal.Id, new DecideBishopInvitationDto { OperationId = Guid.NewGuid(), Version = row.Version, Accept = false }, default);
            row = await service.GetAsync(organization, proposal.Id, default);
        }
        await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(organization, proposal.Id,
            new DecideBishopInvitationDto { OperationId = Guid.NewGuid(), Version = row.Version, Accept = true }, default));
        Assert.Null(await fixture.Services.GetRequiredService<IRecordTransactions>().ReadAsync<BishopSeat>(
            new RecordScope { Area = RecordArea.Archdiocese, OwnerId = organization }, "bishopSeat", default));
    }

    [Fact]
    public async Task Competing_accepted_invitations_have_only_one_atomic_first_seat_winner()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var organization = await fixture.OrganizationAsync();
        var first = await fixture.ProposeAsync(organization);
        await fixture.ReviewAsync(organization, first.Id);
        var second = await fixture.ProposeAsync(organization);
        await fixture.ReviewAsync(organization, second.Id);
        fixture.As(fixture.Nominee);
        var service = fixture.Services.GetRequiredService<BishopAppointmentService>();
        var rows = new[] { await service.GetAsync(organization, first.Id, default), await service.GetAsync(organization, second.Id, default) };
        var outcomes = await Task.WhenAll(rows.Select(async row =>
        {
            try
            {
                return await service.DecideAsync(organization, row.Value.Id,
                    new DecideBishopInvitationDto { OperationId = Guid.NewGuid(), Version = row.Version, Accept = true }, default);
            }
            catch (DomainException error) when (error.Kind == FailureKind.Conflict) { return null; }
        }));
        var winner = Assert.Single(outcomes, value => value is not null);
        var seat = await fixture.Services.GetRequiredService<IRecordTransactions>().ReadAsync<BishopSeat>(
            new RecordScope { Area = RecordArea.Archdiocese, OwnerId = organization }, "bishopSeat", default);
        Assert.Equal(winner!.Id, seat!.Value.AppointmentId);
        var states = await Task.WhenAll(rows.Select(row => service.GetAsync(organization, row.Value.Id, default)));
        Assert.Single(states, row => row.Value.Status == "Accepted");
    }

    [Fact]
    public async Task Stored_account_deactivation_or_missing_mfa_stops_bishop_authority_on_the_next_check()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var organization = await fixture.OrganizationAsync();
        var proposal = await fixture.ProposeAsync(organization);
        await fixture.ReviewAsync(organization, proposal.Id);
        fixture.As(fixture.Nominee);
        var service = fixture.Services.GetRequiredService<BishopAppointmentService>();
        var invitation = await service.GetAsync(organization, proposal.Id, default);
        await service.DecideAsync(organization, proposal.Id, new DecideBishopInvitationDto { OperationId = Guid.NewGuid(), Version = invitation.Version, Accept = true }, default);
        var authority = fixture.Services.GetRequiredService<IArchdioceseAuthority>();
        await authority.RequireBishopAsync(organization, default);
        fixture.As(fixture.Nominee, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => authority.RequireBishopAsync(organization, default));
        fixture.As(fixture.Nominee);
        var users = fixture.Services.GetRequiredService<UserManager<ParishUser>>();
        var account = (await users.FindByIdAsync(fixture.Nominee))!;
        account.Active = false;
        Assert.True((await users.UpdateAsync(account)).Succeeded);
        await Assert.ThrowsAsync<DomainException>(() => authority.RequireBishopAsync(organization, default));
    }
}
