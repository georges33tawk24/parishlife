using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using Xunit;

namespace ParishLive.IntegrationTests;

/// <summary>
/// The Phase 2 gate: a person holds several distinct group roles at once, past committee terms stay
/// in the record, groups are tenant-scoped, and the contextual profile aggregates it — visible only
/// to that person's own parish.
/// </summary>
public class GroupsAndProfileTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public GroupsAndProfileTests(TestAppFactory factory) => _factory = factory;

    private AppDbContext ContextFor(bool archAdmin, params Guid[] parishes)
    {
        _ = _factory.Services; // ensure host started (migrated + seeded)
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_factory.Connection).Options;
        return new AppDbContext(options, new StaticTenantContext(SeedIds.Org, parishes, archAdmin));
    }

    private async Task<string> UserId(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return (await users.FindByEmailAsync(email))!.Id;
    }

    [Fact]
    public async Task Member_holds_three_distinct_current_group_roles()
    {
        var ritaId = await UserId(SeedIds.RitaEmail);
        await using var db = ContextFor(false, SeedIds.ParishA);

        var current = await db.GroupMembers.Where(gm => gm.UserId == ritaId && gm.EndDate == null).ToListAsync();

        Assert.Equal(3, current.Count);
        Assert.Equal(3, current.Select(c => c.GroupId).Distinct().Count());
        Assert.Contains(current, c => c.Role == CommitteeRole.President);
        Assert.Contains(current, c => c.Role == CommitteeRole.RegularMember);
        Assert.Contains(current, c => c.Role == CommitteeRole.Treasurer);
    }

    [Fact]
    public async Task Past_committee_term_is_retained_in_history()
    {
        var ritaId = await UserId(SeedIds.RitaEmail);
        await using var db = ContextFor(false, SeedIds.ParishA);

        var past = await db.GroupMembers.Where(gm => gm.UserId == ritaId && gm.EndDate != null).ToListAsync();

        Assert.Single(past);
        Assert.Equal(CommitteeRole.Secretary, past[0].Role);
        Assert.NotNull(past[0].EndDate);
    }

    [Fact]
    public async Task Groups_are_scoped_to_the_parish()
    {
        await using var a = ContextFor(false, SeedIds.ParishA);
        Assert.True(await a.Groups.AnyAsync(g => g.Name == "Youth Group"));

        await using var b = ContextFor(false, SeedIds.ParishB);
        Assert.False(await b.Groups.AnyAsync());
    }

    [Fact]
    public async Task Profile_page_shows_the_members_roles_to_their_own_priest()
    {
        var ritaId = await UserId(SeedIds.RitaEmail);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, await UserId(SeedIds.PriestAEmail));

        var html = await client.GetStringAsync($"/People/Profile?id={ritaId}");

        Assert.Contains("Rita Khoury", html);
        Assert.Contains("Youth Group", html);
        Assert.Contains("President", html);
        Assert.Contains("Treasurer", html);
    }

    [Fact]
    public async Task Profile_of_another_parishs_member_is_not_shown()
    {
        var ritaId = await UserId(SeedIds.RitaEmail);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, await UserId(SeedIds.PriestBEmail)); // Parish B

        var html = await client.GetStringAsync($"/People/Profile?id={ritaId}");

        Assert.DoesNotContain("Youth Group", html); // Rita is Parish A; the Parish B priest can't see her
    }
}
