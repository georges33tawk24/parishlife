// Purpose: verifies the combined Home and explicit capacity list (D01) through real local services and storage.
// Main tests: a member sees only their own parish relationships and unread notices; staff capacities are listed separately with duties left after
// denials and disappear when the appointment stops being effective; a single capacity enters directly and several require a choice; the bishop
// seat is a capacity; the home refuses a selected appointment and recovery sessions; the all-parish browse needs no account.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.PersonalWorkspace;
using ParishLife.Api.Services.Publishing;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CombinedHomeTests
{
    [Fact]
    public async Task Home_shows_only_the_accounts_own_relationships_counts_and_separate_valid_capacities()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var office = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite, Permissions.ScheduleRead], denies: [Permissions.ScheduleRead]));
        var home = f.Services.GetRequiredService<CombinedHomeService>();
        var membership = f.Services.GetRequiredService<MembershipService>();

        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, mfa: false);
        var empty = await home.HomeAsync(default);
        Assert.Equal(("NoParish", 0, 0), (empty.HomeState, empty.Parishes.Length, empty.Capacities.Length));
        var request = await membership.RequestAsync(staff.Parish, new RequestMembershipDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Applicant", BirthDate = new DateOnly(1990, 5, 1), Locality = "Isolated town"
        }, default);
        var pending = await home.HomeAsync(default);
        Assert.Equal("Personal", pending.HomeState);
        var parish = Assert.Single(pending.Parishes);
        Assert.Equal((true, false, true, false, 0), (parish.Following, parish.Member, parish.MembershipPending, parish.Primary, parish.UnreadNotifications));
        Assert.Empty(parish.CapacityKinds);
        Assert.False(pending.SessionHasMfa);

        // The office decision leaves the applicant one notice; it shows only in the applicant's home, never in the office holder's.
        f.AsAppointment(f.Other, office.Id);
        var row = (await membership.QueueAsync(staff.Parish, default)).Single(r => r.Value.Id == request.Id);
        await membership.DecideAsync(staff.Parish, request.Id, new MembershipDecisionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "decline", Reason = "Isolated decline" }, default);
        f.As(member, mfa: false);
        var decided = await home.HomeAsync(default);
        Assert.Equal((1, 1, false), (decided.UnreadNotifications, decided.Parishes[0].UnreadNotifications, decided.Parishes[0].MembershipPending));

        // Office holder: one priest capacity with the denied duty removed, entered directly; no applicant data or office counts in the home.
        f.As(f.Other);
        var single = await home.HomeAsync(default);
        Assert.Equal("SingleCapacity", single.HomeState);
        var priest = Assert.Single(single.Capacities);
        Assert.Equal(("Priest", office.Id, staff.Parish), (priest.Kind, priest.AppointmentId, priest.ParishId));
        Assert.Equal([Permissions.PeopleRead, Permissions.PeopleWrite], priest.Capabilities);
        Assert.Equal(priest.AppointmentId, single.DirectCapacity!.AppointmentId);
        Assert.Equal(0, single.UnreadNotifications);
        Assert.Equal(["Priest"], Assert.Single(single.Parishes).CapacityKinds);
        Assert.False(single.Parishes[0].Following);

        // A second, unrelated capacity is listed separately and requires an explicit choice; duties are never merged.
        var admin = await staff.AcceptAsync(await staff.InviteAsync(f.Other, admin: true));
        f.As(f.Other);
        var choose = await home.HomeAsync(default);
        Assert.Equal("ChooseCapacity", choose.HomeState);
        Assert.Null(choose.DirectCapacity);
        Assert.Equal(["ArchdioceseAdmin", "Priest"], choose.Capacities.Select(c => c.Kind).Order(StringComparer.Ordinal).ToArray());
        Assert.DoesNotContain(Permissions.PeopleWrite, choose.Capacities.Single(c => c.Kind == "ArchdioceseAdmin").Capabilities);

        // A capacity that stops being effective disappears at once without a new login.
        await staff.ActAsync(office, StaffAppointmentAction.Suspend);
        f.As(f.Other);
        Assert.Equal(admin.Id, Assert.Single(await home.CapacitiesAsync(default)).AppointmentId);

        // The bishop seat is its own capacity.
        f.As(f.Nominee);
        var bishop = Assert.Single(await home.CapacitiesAsync(default));
        Assert.Equal(("Bishop", staff.Organization), (bishop.Kind, bishop.ArchdioceseId));
    }

    [Fact]
    public async Task Home_refuses_selected_appointments_and_recovery_sessions_and_browse_needs_no_account()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        var office = await staff.AcceptAsync(await staff.InviteAsync(f.Other));
        var home = f.Services.GetRequiredService<CombinedHomeService>();

        f.AsAppointment(f.Other, office.Id);
        Assert.Equal("personal_context_required", (await Assert.ThrowsAsync<DomainException>(() => home.HomeAsync(default))).Code);
        Assert.Equal("personal_context_required", (await Assert.ThrowsAsync<DomainException>(() => home.CapacitiesAsync(default))).Code);
        f.AsRecovery(f.Other);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => home.HomeAsync(default))).Kind);

        // Ended or never-accepted staff history without a current capacity is the awaiting-assignment state.
        var invited = await f.CreateVerifiedStaffAsync();
        await staff.InviteAsync(invited);
        f.As(invited);
        var awaiting = await home.HomeAsync(default);
        Assert.Equal(("AwaitingAssignment", 1, 0), (awaiting.HomeState, awaiting.PendingStaffInvitations, awaiting.Capacities.Length));

        f.Services.GetRequiredService<Microsoft.AspNetCore.Http.IHttpContextAccessor>().HttpContext = null;
        Assert.Equal(staff.Parish, Assert.Single((await f.Services.GetRequiredService<PublicDirectoryService>().BrowseAsync(null, default)).Items).ParishId);
    }
}
