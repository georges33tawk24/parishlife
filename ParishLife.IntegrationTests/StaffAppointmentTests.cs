// Purpose: tests jurisdiction and staff authority against actual Identity, services and isolated conditional document storage.
// Main tests: acceptance/MFA/dates, role separation, selected duties/denials, head conflict/history, stale rollback, lifecycle revocation and account-bound discovery.

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Authorization;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class StaffAppointmentTests
{
    [Fact]
    public async Task Bishop_qualification_requires_own_selected_office_and_survives_revocation_of_an_unrelated_technical_grant()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var clergy = fixture.Services.GetRequiredService<IClergyAuthority>();
        fixture.As(fixture.Nominee);
        await Assert.ThrowsAsync<DomainException>(() => clergy.RequireAsync(scenario.Parish, fixture.Nominee, "Bishop", default));
        fixture.As(fixture.FirstAdmin);
        var service = fixture.Services.GetRequiredService<ParishService>();
        await service.GrantAsync(scenario.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await scenario.Parishes.GetAsync(scenario.Parish, default))!.Version,
            AccountId = Guid.Parse(fixture.Nominee), Allows = [Permissions.PeopleRead], StartsAt = fixture.Clock.Now
        }, default);
        await service.RevokeAsync(scenario.Parish, new RevokeAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await scenario.Parishes.GetAsync(scenario.Parish, default))!.Version,
            AccountId = Guid.Parse(fixture.Nominee), Reason = "Ending unrelated technical duties"
        }, default);
        var seat = await fixture.Services.GetRequiredService<IRecordTransactions>().ReadAsync<BishopSeat>(
            StaffAppointmentAccess.Scope(scenario.Organization, null), "bishopSeat", default);
        fixture.AsAppointment(fixture.Nominee, seat!.Value.AppointmentId);
        await clergy.RequireAsync(scenario.Parish, fixture.Nominee, "Bishop", default);
        await Assert.ThrowsAsync<DomainException>(() => fixture.Services.GetRequiredService<IParishAccess>().RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
        fixture.AsAppointment(fixture.FirstAdmin, seat.Value.AppointmentId);
        await Assert.ThrowsAsync<DomainException>(() => clergy.RequireAsync(scenario.Parish, fixture.FirstAdmin, "Bishop", default));
    }

    [Fact]
    public async Task Head_designation_requires_a_free_period_and_keeps_an_explicit_history()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var first = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other));
        var secondAccount = await fixture.CreateVerifiedStaffAsync();
        var second = await scenario.AcceptAsync(await scenario.InviteAsync(secondAccount));
        async Task<StaffAppointmentDto> Designate(StaffAppointmentDto appointment)
        {
            fixture.As(fixture.Nominee);
            var row = await scenario.Service.GetAsync(scenario.Organization, scenario.Parish, appointment.Id, default);
            return await scenario.Service.DesignateHeadAsync(scenario.Organization, scenario.Parish, appointment.Id, new DesignateHeadPriestDto
            {
                OperationId = Guid.NewGuid(),
                Version = row.Version,
                StartsAt = fixture.Clock.Now,
                EndsAt = fixture.Clock.Now.AddDays(5),
                Reason = "Isolated explicit designation",
                EvidenceReference = "isolated designation evidence",
                CurrentPassword = "isolated-fixture-long-password",
                CurrentCode = RealIdentityWorkflowTests.FixtureCode()
            }, default);
        }
        Assert.True((await Designate(first)).Head);
        Assert.Equal("head_priest_conflict", (await Assert.ThrowsAsync<DomainException>(() => Designate(second))).Code);
        await scenario.ActAsync(first, StaffAppointmentAction.Suspend);
        Assert.Equal("head_priest_conflict", (await Assert.ThrowsAsync<DomainException>(() => Designate(second))).Code);
        await scenario.ActAsync(first, StaffAppointmentAction.Revoke);
        Assert.True((await Designate(second)).Head);
        var history = await fixture.Services.GetRequiredService<IRecordTransactions>().PageAsync<HeadDesignationChange>(
            StaffAppointmentAccess.Scope(scenario.Organization, scenario.Parish), "headDesignationChange", 25, null, default);
        Assert.Equal(2, history.Items.Count);
        Assert.All(history.Items, row => Assert.Equal(fixture.Nominee, row.Value.RecordedBy));
    }

    [Fact]
    public async Task Pending_acceptance_rechecks_issuer_but_an_accepted_office_does_not_end_when_its_original_bishop_leaves()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var accepted = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other));
        var secondAccount = await fixture.CreateVerifiedStaffAsync();
        var pending = await scenario.InviteAsync(secondAccount);
        var users = fixture.Services.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ParishLife.Api.Identity.ParishUser>>();
        var bishop = (await users.FindByIdAsync(fixture.Nominee))!;
        bishop.Active = false;
        Assert.True((await users.UpdateAsync(bishop)).Succeeded);
        await Assert.ThrowsAsync<DomainException>(() => scenario.AcceptAsync(pending));
        fixture.AsAppointment(fixture.Other, accepted.Id);
        await fixture.Services.GetRequiredService<IParishAccess>().RequireAsync(scenario.Parish, Permissions.PeopleRead, default);
        fixture.Clock.Now = fixture.Clock.Now.AddDays(11);
        await fixture.Services.GetRequiredService<IParishAccess>().RequireAsync(scenario.Parish, Permissions.PeopleRead, default);
    }

    [Fact]
    public async Task Fresh_proofs_explicit_duties_and_scope_versions_are_enforced_before_any_invitation_is_saved()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        fixture.As(fixture.Nominee);
        var before = (await scenario.Parishes.GetAsync(scenario.Parish, default))!;
        var request = new InviteStaffAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            ScopeVersion = before.Version,
            AccountId = Guid.Parse(fixture.Other),
            Role = StaffAppointmentRole.Priest,
            Allows = [Permissions.PeopleRead],
            StartsAt = fixture.Clock.Now,
            EndsAt = fixture.Clock.Now.AddDays(20),
            AcceptBy = fixture.Clock.Now.AddDays(1),
            Reason = "Isolated invalid invitation",
            EvidenceReference = "isolated evidence",
            CurrentPassword = "isolated-fixture-long-password",
            CurrentCode = "bad-proof"
        };
        Assert.Equal("credentials_invalid", (await Assert.ThrowsAsync<DomainException>(() => scenario.Service.InviteAsync(scenario.Organization, scenario.Parish, request, default))).Code);
        request.CurrentCode = RealIdentityWorkflowTests.FixtureCode();
        request.Allows = [Permissions.FinancePost];
        Assert.Equal("invalid_staff_duties", (await Assert.ThrowsAsync<DomainException>(() => scenario.Service.InviteAsync(scenario.Organization, scenario.Parish, request, default))).Code);
        request.Allows = [Permissions.PeopleRead];
        request.ScopeVersion = "stale";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => scenario.Service.InviteAsync(scenario.Organization, scenario.Parish, request, default))).Code);
        Assert.Equal(before.Version, (await scenario.Parishes.GetAsync(scenario.Parish, default))!.Version);
        Assert.Empty((await scenario.Service.ListAsync(scenario.Organization, scenario.Parish, 25, null, default)).Items);
    }

    [Fact]
    public async Task Acceptance_requires_own_mfa_and_effective_dates_without_promoting_platform_operators()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var invitation = await scenario.InviteAsync(fixture.Other, startsAt: fixture.Clock.Now.AddHours(1));
        var access = fixture.Services.GetRequiredService<IParishAccess>();
        fixture.AsAppointment(fixture.Other, invitation.Id);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
        Assert.Null((await scenario.Service.GetAsync(scenario.Organization, scenario.Parish, invitation.Id, default)).Value.EvidenceReference);
        fixture.As(fixture.SecondAdmin);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Service.ListAsync(scenario.Organization, scenario.Parish, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => scenario.Service.InviteAsync(scenario.Organization, scenario.Parish, new InviteStaffAppointmentDto(), default));
        fixture.As(fixture.Other, mfa: false);
        var row = await scenario.Service.GetAsync(scenario.Organization, scenario.Parish, invitation.Id, default);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Service.DecideAsync(scenario.Organization, scenario.Parish, invitation.Id,
            new DecideStaffAppointmentDto { OperationId = Guid.NewGuid(), Version = row.Version, Accept = true }, default));
        var accepted = await scenario.AcceptAsync(invitation);
        Assert.Equal("Scheduled", accepted.Status);
        Assert.False(accepted.Effective);
        fixture.AsAppointment(fixture.Other, invitation.Id);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
        fixture.Clock.Now = invitation.StartsAt;
        await access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default);
        fixture.Clock.Now = invitation.EndsAt!.Value;
        Assert.Equal("Expired", (await scenario.Service.GetAsync(scenario.Organization, scenario.Parish, invitation.Id, default)).Value.Status);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
    }

    [Fact]
    public async Task Selected_priest_duties_never_union_with_legacy_grants_and_explicit_denials_survive_switching()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var appointment = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other));
        var service = fixture.Services.GetRequiredService<ParishService>();
        fixture.As(fixture.FirstAdmin);
        await service.GrantAsync(scenario.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await scenario.Parishes.GetAsync(scenario.Parish, default))!.Version,
            AccountId = Guid.Parse(fixture.Other),
            Allows = [Permissions.PeopleWrite],
            StartsAt = fixture.Clock.Now
        }, default);
        var access = fixture.Services.GetRequiredService<IParishAccess>();
        fixture.As(fixture.Other);
        await access.RequireAsync(scenario.Parish, Permissions.PeopleWrite, default);
        fixture.AsAppointment(fixture.Other, appointment.Id);
        await access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleWrite, default));
        fixture.As(fixture.FirstAdmin);
        await service.GrantAsync(scenario.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await scenario.Parishes.GetAsync(scenario.Parish, default))!.Version,
            AccountId = Guid.Parse(fixture.Other),
            Allows = [Permissions.PeopleWrite],
            Denies = [Permissions.PeopleRead],
            StartsAt = fixture.Clock.Now
        }, default);
        fixture.AsAppointment(fixture.Other, appointment.Id);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
        Assert.DoesNotContain(Permissions.PeopleRead, (await scenario.Service.WorkspaceAsync(scenario.Organization, scenario.Parish, appointment.Id, default)).Capabilities);
        var otherParish = await fixture.JurisdictionParishAsync(scenario.Organization);
        fixture.AsAppointment(fixture.Other, appointment.Id);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(otherParish, Permissions.PeopleRead, default));
        fixture.Services.GetRequiredService<IHttpContextAccessor>().HttpContext!.Request.Headers["X-ParishLife-Appointment"] = "malformed";
        Assert.Equal("invalid_acting_appointment", (await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default))).Code);
    }

    [Fact]
    public async Task Archdiocese_admin_reads_explicit_metadata_but_cannot_become_bishop_or_priest()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var admin = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other, admin: true));
        fixture.AsAppointment(fixture.Other, admin.Id);
        var page = await scenario.Service.ListAsync(scenario.Organization, null, 25, null, default);
        Assert.Null(Assert.Single(page.Items).Value.EvidenceReference);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Service.ListAsync(scenario.Organization, scenario.Parish, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => scenario.Service.InviteAsync(scenario.Organization, null, new InviteStaffAppointmentDto(), default));
        await Assert.ThrowsAsync<DomainException>(() => fixture.Services.GetRequiredService<IClergyAuthority>().RequireAsync(scenario.Parish, fixture.Other, "Priest", default));
        await Assert.ThrowsAsync<DomainException>(() => fixture.Services.GetRequiredService<IArchdioceseAuthority>().RequireBishopAsync(scenario.Organization, default));
        fixture.As(fixture.Other);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Service.ListAsync(scenario.Organization, null, 25, null, default));
    }

    [Fact]
    public async Task Suspension_revocation_and_account_deactivation_stop_authority_on_the_next_check()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var appointment = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other));
        var access = fixture.Services.GetRequiredService<IParishAccess>();
        await scenario.ActAsync(appointment, StaffAppointmentAction.Suspend);
        fixture.AsAppointment(fixture.Other, appointment.Id);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
        await scenario.ActAsync(appointment, StaffAppointmentAction.Resume);
        fixture.AsAppointment(fixture.Other, appointment.Id);
        await access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default);
        var users = fixture.Services.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ParishLife.Api.Identity.ParishUser>>();
        var user = (await users.FindByIdAsync(fixture.Other))!;
        user.Active = false;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
        user.Active = true;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        user.TwoFactorEnabled = false;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
        user.TwoFactorEnabled = true;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        Assert.True((await users.SetLockoutEnabledAsync(user, true)).Succeeded);
        Assert.True((await users.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddMinutes(5))).Succeeded);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
        Assert.True((await users.SetLockoutEndDateAsync(user, null)).Succeeded);
        await scenario.ActAsync(appointment, StaffAppointmentAction.Revoke);
        fixture.AsAppointment(fixture.Other, appointment.Id);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(scenario.Parish, Permissions.PeopleRead, default));
    }

    [Fact]
    public async Task Concurrent_head_acceptance_has_one_winner_and_explicit_handover_preserves_ordinary_priest_office()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var secondAccount = await fixture.CreateVerifiedStaffAsync();
        var first = await scenario.InviteAsync(fixture.Other, head: true);
        var second = await scenario.InviteAsync(secondAccount, head: true);
        var outcomes = await Task.WhenAll(new[] { first, second }.Select(async invitation =>
        {
            try
            { return await scenario.AcceptAsync(invitation); }
            catch (DomainException error) when (error.Kind == FailureKind.Conflict) { return null; }
        }));
        var winner = Assert.Single(outcomes, value => value is not null)!;
        var loser = winner.Id == first.Id ? second : first;
        Assert.True(winner.Head);
        await scenario.ActAsync(winner, StaffAppointmentAction.Suspend);
        var reserved = await Assert.ThrowsAsync<DomainException>(() => scenario.AcceptAsync(loser));
        Assert.Equal("head_priest_conflict", reserved.Code);
        await scenario.ActAsync(winner, StaffAppointmentAction.Resume);
        fixture.As(fixture.Nominee);
        var row = await scenario.Service.GetAsync(scenario.Organization, scenario.Parish, winner.Id, default);
        await scenario.Service.EndHeadAsync(scenario.Organization, scenario.Parish, winner.Id, new EndHeadPriestDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            EndsAt = fixture.Clock.Now,
            Reason = "Explicit isolated handover",
            EvidenceReference = "isolated handover evidence",
            CurrentPassword = "isolated-fixture-long-password",
            CurrentCode = RealIdentityWorkflowTests.FixtureCode()
        }, default);
        var replacement = await scenario.AcceptAsync(loser);
        Assert.True(replacement.Head);
        fixture.AsAppointment(winner.AccountId, winner.Id);
        var workspace = await scenario.Service.WorkspaceAsync(scenario.Organization, scenario.Parish, winner.Id, default);
        Assert.False(workspace.Appointment.Head);
        Assert.True(workspace.Appointment.Effective);
        Assert.True(workspace.HasCurrentHead);
        Assert.True(workspace.HasHeadReservation);
        await fixture.Services.GetRequiredService<IClergyAuthority>().RequireAsync(scenario.Parish, winner.AccountId, "Priest", default);
    }

    [Fact]
    public async Task Review_retains_history_without_extending_office_and_stale_actions_roll_back_the_scope_fence()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var appointment = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other));
        var review = await scenario.ActAsync(appointment, StaffAppointmentAction.Review, fixture.Clock.Now.AddDays(6));
        Assert.Equal(appointment.EndsAt, review.EndsAt);
        Assert.NotNull(review.LastReviewedAt);
        fixture.As(fixture.Nominee);
        var before = (await scenario.Parishes.GetAsync(scenario.Parish, default))!;
        var error = await Assert.ThrowsAsync<DomainException>(() => scenario.Service.ActAsync(scenario.Organization, scenario.Parish, appointment.Id,
            new ActStaffAppointmentDto
            {
                OperationId = Guid.NewGuid(),
                Version = "stale",
                Action = StaffAppointmentAction.Revoke,
                Reason = "Isolated stale action",
                CurrentPassword = "isolated-fixture-long-password",
                CurrentCode = RealIdentityWorkflowTests.FixtureCode()
            }, default));
        Assert.Equal("write_conflict", error.Code);
        Assert.Equal(before.Version, (await scenario.Parishes.GetAsync(scenario.Parish, default))!.Version);
        Assert.True((await scenario.Service.GetAsync(scenario.Organization, scenario.Parish, appointment.Id, default)).Value.Effective);
        var reviews = await fixture.Services.GetRequiredService<IRecordTransactions>().PageAsync<StaffAppointmentReview>(
            StaffAppointmentAccess.Scope(scenario.Organization, scenario.Parish), "staffAppointmentReview", 25, null, default);
        Assert.Equal(appointment.ReviewDueAt, Assert.Single(reviews.Items).Value.PreviousDueAt);
    }

    [Fact]
    public async Task Personal_directory_is_paged_account_bound_and_cannot_leak_private_evidence()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        await scenario.InviteAsync(fixture.Other);
        await scenario.InviteAsync(fixture.Other, admin: true);
        fixture.As(fixture.Other);
        var first = await scenario.Service.OwnAsync(1, null, default);
        Assert.Single(first.Items);
        Assert.Null(first.Items[0].Value.EvidenceReference);
        Assert.NotNull(first.ContinuationToken);
        var next = await scenario.Service.OwnAsync(1, first.ContinuationToken, default);
        Assert.Single(next.Items);
        Assert.NotEqual(first.Items[0].Value.Id, next.Items[0].Value.Id);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Service.OwnAsync(2, first.ContinuationToken, default));
        fixture.As(fixture.Nominee);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Service.OwnAsync(1, first.ContinuationToken, default));
        Assert.Empty((await scenario.Service.OwnAsync(25, null, default)).Items);
    }

    [Fact]
    public async Task Commercial_association_acceptance_and_end_preserve_actual_jurisdiction_and_priest_authority()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var appointment = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other));
        fixture.As(fixture.FirstAdmin);
        var service = fixture.Services.GetRequiredService<ParishService>();
        var association = await service.ProposeAssociationAsync(scenario.Parish, new AssociationProposalDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await scenario.Parishes.GetAsync(scenario.Parish, default))!.Version,
            ArchdioceseId = Guid.Parse(scenario.Organization)
        }, default);
        await service.DecideAssociationAsync(scenario.Parish, association.Id, new AssociationDecisionDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await service.GetAssociationAsync(scenario.Parish, association.Id, default)).Version,
            Accept = true
        }, default);
        var associated = (await scenario.Parishes.GetAsync(scenario.Parish, default))!;
        Assert.Equal(scenario.Organization, associated.Value.JurisdictionArchdioceseId);
        Assert.Equal(scenario.Organization, associated.Value.RegisteredArchdioceseId);
        await service.EndAssociationAsync(scenario.Parish, new EndAssociationDto
        {
            OperationId = Guid.NewGuid(),
            Version = associated.Version,
            Reason = "Isolated commercial association end"
        }, default);
        var independent = (await scenario.Parishes.GetAsync(scenario.Parish, default))!.Value;
        Assert.Null(independent.RegisteredArchdioceseId);
        Assert.Equal(scenario.Organization, independent.JurisdictionArchdioceseId);
        fixture.AsAppointment(fixture.Other, appointment.Id);
        await fixture.Services.GetRequiredService<IParishAccess>().RequireAsync(scenario.Parish, Permissions.PeopleRead, default);
    }

    [Fact]
    public async Task Replaying_acceptance_reports_current_revocation_and_audit_records_selected_bishop_without_credentials()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        var invitation = await scenario.InviteAsync(fixture.Other);
        fixture.As(fixture.Other);
        var row = await scenario.Service.GetAsync(scenario.Organization, scenario.Parish, invitation.Id, default);
        var request = new DecideStaffAppointmentDto { OperationId = Guid.NewGuid(), Version = row.Version, Accept = true };
        await scenario.Service.DecideAsync(scenario.Organization, scenario.Parish, invitation.Id, request, default);
        await scenario.ActAsync(invitation, StaffAppointmentAction.Revoke);
        fixture.As(fixture.Other);
        Assert.Equal("Revoked", (await scenario.Service.DecideAsync(scenario.Organization, scenario.Parish, invitation.Id, request, default)).Status);
        var audit = await fixture.Services.GetRequiredService<IRecordTransactions>().PageAsync<AuditEntry>(
            StaffAppointmentAccess.Scope(scenario.Organization, scenario.Parish), "audit", 100, null, default);
        Assert.Contains(audit.Items, entry => entry.Value.Action == "staff_appointment.invited" && entry.Value.ActingAppointmentId is not null);
        foreach (var file in Directory.EnumerateFiles(fixture.DirectoryPath, "*.json", SearchOption.AllDirectories))
        {
            var text = await File.ReadAllTextAsync(file);
            Assert.DoesNotContain("currentPassword", text, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("currentCode", text, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("isolated-fixture-long-password", text, StringComparison.Ordinal);
        }
    }
}
