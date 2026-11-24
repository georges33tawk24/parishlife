// Purpose: verifies automatic retention (owner decision, 23 November 2026) through real local services and storage.
// Main tests: notices read or archived more than a year ago are deleted while recent, unread and other accounts' recent notices stay;
// anonymous site counts older than two years are deleted while younger days stay; the capability list says what really happens.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Reporting;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Operations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RetentionTests
{
    [Fact]
    public async Task Notices_read_over_a_year_ago_are_deleted_and_everything_else_stays()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var now = f.Clock.Now;
        var account = await f.CreateVerifiedMemberAsync();
        var other = await f.CreateVerifiedMemberAsync();
        async Task<string> NoticeAsync(string owner, string status, DateTimeOffset created, DateTimeOffset? read)
        {
            var notice = new Notification
            {
                Id = Guid.NewGuid().ToString("N"), AccountId = owner, Kind = "Required", Topic = "test.topic", Title = "Isolated notice",
                Status = status, CreatedAt = created, ReadAt = read
            };
            await records.CommitAsync(new RecordScope { Area = RecordArea.Account, OwnerId = owner },
                Operation.Create(Guid.NewGuid(), "isolated-test", new { notice.Id }, f.Clock), "test.notice", notice.Id,
                [RecordChange.Create("notification:" + notice.Id, "notification", notice)], new CommandResult { Id = notice.Id, Status = status }, default);
            return notice.Id;
        }
        var oldRead = await NoticeAsync(account, "Read", now.AddDays(-500), now.AddDays(-400));
        var oldArchived = await NoticeAsync(account, "Archived", now.AddDays(-500), now.AddDays(-370));
        var recentRead = await NoticeAsync(account, "Read", now.AddDays(-200), now.AddDays(-100));
        var oldUnread = await NoticeAsync(account, "Unread", now.AddDays(-900), null);
        var otherRecent = await NoticeAsync(other, "Read", now.AddDays(-30), now.AddDays(-20));

        var retention = f.Services.GetRequiredService<RetentionService>();
        string? cursor = null;
        var deleted = 0;
        do
        {
            (cursor, var count) = await retention.PurgeNoticesAsync(cursor, default);
            deleted += count;
        }
        while (cursor is not null);

        Assert.Equal(2, deleted);
        async Task<bool> ExistsAsync(string owner, string id)
            => await records.ReadAsync<Notification>(new RecordScope { Area = RecordArea.Account, OwnerId = owner }, "notification:" + id, default) is not null;
        Assert.False(await ExistsAsync(account, oldRead));
        Assert.False(await ExistsAsync(account, oldArchived));
        Assert.True(await ExistsAsync(account, recentRead));
        Assert.True(await ExistsAsync(account, oldUnread));
        Assert.True(await ExistsAsync(other, otherRecent));
    }

    [Fact]
    public async Task Site_counts_older_than_two_years_are_deleted_and_younger_days_stay()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var metrics = f.Services.GetRequiredService<ISiteMetricStore>();
        var today = DateOnly.FromDateTime(f.Clock.Now.UtcDateTime);
        var expired = today.AddDays(-RetentionService.SiteCountRetentionDays - 5);
        var kept = today.AddDays(-RetentionService.SiteCountRetentionDays + 5);
        foreach (var day in new[] { expired, kept })
            for (var i = 0; i < 3; i++)
                Assert.True(await metrics.IncrementAsync(day, "page.directory", "en", null, default));

        Assert.True(await f.Services.GetRequiredService<RetentionService>().PurgeSiteCountsAsync(default) > 0);
        Assert.Empty(await metrics.DayAsync(expired, default));
        Assert.Equal(3, (await metrics.DayAsync(kept, default)).Sum(m => m.Count));
    }

    [Fact]
    public async Task Capabilities_report_retention_only_when_scheduled_jobs_run_here()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var list = f.Services.GetRequiredService<CapabilityService>().List().ToDictionary(c => c.Name);
        // The isolated fixture runs no background jobs, so nothing is deleted automatically and the list says so.
        Assert.False(list["Retention and deletion"].Available);
        Assert.Contains("nothing is deleted automatically", list["Retention and deletion"].Behaviour);
        Assert.False(list["SMS delivery"].Available);
        Assert.False(list["Online payments"].Available);
    }
}
