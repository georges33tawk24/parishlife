using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using Xunit;

namespace ParishLive.IntegrationTests;

/// <summary>
/// The Phase 1 gate: Parish A must never see Parish B — across the data layer, the SaveChanges guard,
/// and the HTTP endpoint — and anonymous callers are rejected.
/// </summary>
public class TenantIsolationTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public TenantIsolationTests(TestAppFactory factory) => _factory = factory;

    private AppDbContext ContextFor(bool archAdmin, params Guid[] parishes)
    {
        // Touch Services to ensure the host has started (and thus migrated + seeded the shared
        // in-memory DB) before we query it directly.
        _ = _factory.Services;

        // Build a self-contained context over the factory's shared in-memory connection so it sees
        // the same seeded data, with a tenant context we control.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_factory.Connection)
            .Options;
        return new AppDbContext(options, new StaticTenantContext(SeedIds.Org, parishes, archAdmin));
    }

    [Fact]
    public async Task Query_filter_scopes_notices_to_the_users_parish()
    {
        await using var a = ContextFor(false, SeedIds.ParishA);
        var aTitles = await a.Notices.Select(n => n.Title).ToListAsync();
        Assert.Contains(aTitles, t => t.StartsWith("St. George"));
        Assert.DoesNotContain(aTitles, t => t.StartsWith("St. Elias"));

        await using var b = ContextFor(false, SeedIds.ParishB);
        var bTitles = await b.Notices.Select(n => n.Title).ToListAsync();
        Assert.Contains(bTitles, t => t.StartsWith("St. Elias"));
        Assert.DoesNotContain(bTitles, t => t.StartsWith("St. George"));
    }

    [Fact]
    public async Task Archdiocese_admin_sees_across_the_org()
    {
        await using var admin = ContextFor(true);
        var titles = await admin.Notices.Select(n => n.Title).ToListAsync();
        Assert.Contains(titles, t => t.StartsWith("St. George"));
        Assert.Contains(titles, t => t.StartsWith("St. Elias"));
    }

    [Fact]
    public async Task SaveChanges_guard_blocks_writing_into_another_parish()
    {
        await using var a = ContextFor(false, SeedIds.ParishA);
        a.Notices.Add(Notice.Create(SeedIds.Org, SeedIds.ParishB, "cross-tenant attempt", "body",
            Domain.Enums.NoticePriority.Normal, Domain.Enums.NoticeAudience.Members, "someone", null));
        await Assert.ThrowsAsync<InvalidOperationException>(() => a.SaveChangesAsync());
    }

    [Fact]
    public async Task Endpoint_returns_only_the_signed_in_priests_parish()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, await UserId(SeedIds.PriestAEmail));

        var titles = await client.GetFromJsonAsync<List<string>>("/api/notices");

        Assert.NotNull(titles);
        Assert.Contains(titles!, t => t.StartsWith("St. George"));
        Assert.DoesNotContain(titles!, t => t.StartsWith("St. Elias"));
    }

    [Fact]
    public async Task Endpoint_rejects_anonymous_callers()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/notices");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<string> UserId(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByEmailAsync(email);
        return user!.Id;
    }
}
