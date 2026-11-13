// Purpose: verifies the shared account-name lookup (GET api/parishes/{id}/account-names) through real local services and storage.
// Main tests: capacity holders are named to related accounts only (members and followers, never strangers); other accounts are
// named only to people.read office callers and only when linked to a person of the parish; inactive accounts are never named;
// the id list is validated (1-100 ids).

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class AccountNamesTests
{
    [Fact]
    public async Task Names_are_revealed_only_to_related_accounts_and_people_readers()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var priest = f.Other;
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(priest, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        var membership = f.Services.GetRequiredService<MembershipService>();
        var names = f.Services.GetRequiredService<AccountNamesService>();
        var parish = staff.Parish;

        var member = await f.CreateVerifiedMemberAsync();
        var follower = await f.CreateVerifiedMemberAsync();
        var stranger = await f.CreateVerifiedMemberAsync();
        await NameAsync(f, priest, "Isolated priest");
        await NameAsync(f, member, "Isolated member");
        await NameAsync(f, follower, "Isolated follower");
        await NameAsync(f, stranger, "Isolated stranger");

        f.As(member);
        var request = await membership.RequestAsync(parish, new RequestMembershipDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Member", BirthDate = new DateOnly(1990, 5, 1), Locality = "Isolated town"
        }, default);
        f.AsAppointment(priest, appointment.Id);
        var row = (await membership.QueueAsync(parish, default)).Single(r => r.Value.Id == request.Id);
        await membership.DecideAsync(parish, request.Id, new MembershipDecisionDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, Action = "create-person", EvidenceReference = "Office identity check"
        }, default);
        f.As(follower);
        await membership.FollowAsync(parish, default);
        var all = string.Join(',', priest, member, follower, stranger);

        // A follower and a member see the current priest, but not each other or anyone unlinked.
        f.As(follower);
        Assert.Equal([(priest, "Isolated priest")], Pairs(await names.ListAsync(parish, all, default)));
        f.As(member);
        Assert.Equal([(priest, "Isolated priest")], Pairs(await names.ListAsync(parish, all, default)));

        // An account with no relation to the parish sees nothing, and is not told why.
        f.As(stranger);
        Assert.Empty(await names.ListAsync(parish, all, default));

        // The office (people.read, office module) also sees linked people, never unlinked followers or strangers.
        f.AsAppointment(priest, appointment.Id);
        Assert.Equal([(member, "Isolated member"), (priest, "Isolated priest")], Pairs(await names.ListAsync(parish, all, default)).OrderBy(p => p.Item2).ToArray());

        // An inactive account is never named.
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var inactive = (await users.FindByIdAsync(member))!;
        inactive.Active = false;
        Assert.True((await users.UpdateAsync(inactive)).Succeeded);
        Assert.Equal([(priest, "Isolated priest")], Pairs(await names.ListAsync(parish, all, default)));

        // An unknown parish reveals nothing.
        Assert.Empty(await names.ListAsync(Guid.NewGuid().ToString(), all, default));
    }

    [Fact]
    public async Task The_id_list_is_validated()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        var names = f.Services.GetRequiredService<AccountNamesService>();
        f.As(f.Other);
        Assert.Equal("ids_required", (await Assert.ThrowsAsync<DomainException>(() => names.ListAsync(staff.Parish, " , ", default))).Code);
        var tooMany = string.Join(',', Enumerable.Range(0, AccountNamesService.MaxIds + 1).Select(_ => Guid.NewGuid().ToString("N")));
        Assert.Equal("too_many_ids", (await Assert.ThrowsAsync<DomainException>(() => names.ListAsync(staff.Parish, tooMany, default))).Code);
        var duplicates = string.Join(',', Enumerable.Repeat(f.Other, AccountNamesService.MaxIds + 5));
        Assert.Empty(await names.ListAsync(staff.Parish, duplicates, default));
    }

    private static (string, string)[] Pairs(IReadOnlyList<AccountNameDto> rows) => rows.Select(r => (r.AccountId, r.DisplayName)).ToArray();

    private static async Task NameAsync(LocalBackendFixture f, string account, string name)
    {
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var user = (await users.FindByIdAsync(account))!;
        user.DisplayName = name;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
    }
}
