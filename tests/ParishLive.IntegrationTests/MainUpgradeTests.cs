using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;
using Xunit;

namespace ParishLive.IntegrationTests;

public sealed class MainUpgradeTests
{
    [Fact]
    public async Task Populated_main_upgrades_without_revoking_appointments_or_blocking_existing_resources()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:"); await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        var org = Guid.NewGuid(); var parish = Guid.NewGuid(); var membership = Guid.NewGuid(); var venue = Guid.NewGuid();
        await using var db = new AppDbContext(options, new StaticTenantContext(org, [parish], true, "upgrade-test"));
        await db.GetService<IMigrator>().MigrateAsync("20260724080837_AddAuditLog");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Organizations (Id, Name) VALUES ({org}, 'Fictional baseline organization')");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Parishes (Id, OrgId, Name) VALUES ({parish}, {org}, 'Fictional baseline parish')");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Memberships (Id, UserId, OrgId, ParishId, Role) VALUES ({membership}, 'baseline-user', {org}, {parish}, {(int)SystemRole.Priest})");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Venues (Id, OrgId, ParishId, Name, Capacity, IsActive, CreatedAt) VALUES ({venue}, {org}, {parish}, 'Existing room', 10, 1, {DateTimeOffset.UtcNow})");
        await db.Database.MigrateAsync();
        var role = await db.Memberships.SingleAsync(m => m.Id == membership);
        Assert.True(role.IsEffective(DateTimeOffset.UtcNow)); Assert.Equal(1, role.Revision); Assert.False(role.IsHeadPriest);
        Assert.True((await db.Venues.SingleAsync(v => v.Id == venue)).IsServiceable);
        var upgraded = await db.Parishes.SingleAsync(p => p.Id == parish);
        Assert.Equal("Active", upgraded.Lifecycle); Assert.False(upgraded.PubliclyListed);
        Assert.False(await db.ParishPolicies.AnyAsync()); // no retrospective policy or consent approval
    }
}
