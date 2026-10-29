using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using ParishLive.Infrastructure.Operations;
using Xunit;

namespace ParishLive.IntegrationTests;

public sealed class ConcurrentAdmissionTests
{
    [Fact]
    public async Task Independent_connections_competing_for_the_final_place_cannot_overbook()
    {
        var path = Path.Combine(Path.GetTempPath(), "parishlife-concurrency-" + Guid.NewGuid().ToString("N") + ".db");
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={path};Pooling=False;Default Timeout=10").Options;
        var org = Guid.NewGuid(); var parish = Guid.NewGuid(); Guid eventId;
        try
        {
            await using (var setup = new AppDbContext(options, new StaticTenantContext(org, [parish], true, "test-setup")))
            {
                await setup.Database.MigrateAsync();
                setup.Organizations.Add(new Organization { Id = org, Name = "Fictional test organization" });
                setup.Parishes.Add(new Parish { Id = parish, OrgId = org, Name = "Fictional test parish" });
                foreach (var user in new[] { "family-one", "family-two" })
                {
                    setup.Users.Add(new ApplicationUser { Id = user, UserName = user, DisplayName = "Fictional " + user });
                    setup.Memberships.Add(new Membership { OrgId = org, ParishId = parish, UserId = user, Role = SystemRole.Member });
                }
                var occurrence = Event.Create(org, parish, "Fictional final-place event", null, null, null,
                    DateTimeOffset.UtcNow.AddDays(1), DateTimeOffset.UtcNow.AddDays(1).AddHours(1), 1, EventVisibility.Members, true);
                eventId = occurrence.Id; setup.Events.Add(occurrence); await setup.SaveChangesAsync();
            }
            var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            async Task Reserve(string user)
            {
                await start.Task;
                var tenant = new StaticTenantContext(org, [parish], false, user) { ActingRole = "Member" };
                await using var db = new AppDbContext(options, tenant);
                await new EventAdmissionService(db, tenant, new(db, tenant), new(db, tenant)).ReserveAsync(eventId, user, null, Guid.NewGuid());
            }
            var first = Task.Run(() => Reserve("family-one")); var second = Task.Run(() => Reserve("family-two"));
            start.SetResult(); await Task.WhenAll(first, second);
            await using var verify = new AppDbContext(options, new StaticTenantContext(org, [parish], true, "test-verifier"));
            var rows = await verify.EventAdmissions.ToListAsync();
            Assert.Equal(2, rows.Count); Assert.Single(rows, r => r.Place == PlaceStatus.Reserved);
            Assert.Single(rows, r => r.Place == PlaceStatus.Waitlisted);
        }
        finally
        {
            foreach (var suffix in new[] { "", "-shm", "-wal" })
                if (File.Exists(path + suffix)) File.Delete(path + suffix);
        }
    }
}
