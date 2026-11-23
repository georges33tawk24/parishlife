// Purpose: proves on real Cosmos DB what local storage cannot (owner decision Q26, 23 November 2026): atomic transactional batches, ETag
// conflicts, receipt replay and indexed queries, through the production RecordTransactions and CosmosDocumentDatabase against ParishLifeTest.
// Each test writes only into its own random partition ("live-test-…"); rows stay in the test database, which never holds real data.
// Main tests: the database guard (always runs, no network); commit, read and replay; a stale version conflicts and a failing batch leaves
// nothing behind; a filtered page uses the deployed index policy.

using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Repositories.Common;
using Xunit;

namespace ParishLife.IntegrationTests.Live;

public class LiveCosmosTests
{
    private sealed class Sample
    {
        public string Id { get; set; } = string.Empty;

        public string Status { get; set; } = string.Empty;
    }

    private static RecordTransactions Records()
        => new(new PartitionDocuments(new CosmosDocumentDatabase(LiveCosmos.Client(), LiveCosmos.Database)), new EphemeralDataProtectionProvider());

    private static RecordScope Scope() => new() { Area = RecordArea.Parish, OwnerId = "live-test-" + Guid.NewGuid().ToString("N") };

    private static Operation Op(object payload) => Operation.Create(Guid.NewGuid(), "live-test", payload, TimeProvider.System);

    private static Task<CommandResult> CreateAsync(RecordTransactions records, RecordScope scope, Sample sample, Operation? op = null)
        => records.CommitAsync(scope, op ?? Op(new { sample.Id }), "live_test.create", sample.Id,
            [RecordChange.Create("liveSample:" + sample.Id, "liveSample", sample)], new CommandResult { Id = sample.Id, Status = sample.Status }, default);

    [Fact]
    public void Only_the_test_database_is_accepted()
    {
        Assert.Equal(LiveCosmos.TestDatabase, LiveCosmos.Guard("ParishLifeTest"));
        Assert.Throws<InvalidOperationException>(() => LiveCosmos.Guard("ParishLife"));
        Assert.Throws<InvalidOperationException>(() => LiveCosmos.Guard(null));
        Assert.Throws<InvalidOperationException>(() => LiveCosmos.Guard("parishlifetest"));
    }

    [LiveCosmosFact]
    public async Task A_commit_is_readable_and_an_exact_retry_replays_without_writing_twice()
    {
        var records = Records();
        var scope = Scope();
        var sample = new Sample { Id = Guid.NewGuid().ToString("N"), Status = "Open" };
        var op = Op(new { sample.Id });
        await CreateAsync(records, scope, sample, op);
        Assert.Equal("Open", (await records.ReadAsync<Sample>(scope, "liveSample:" + sample.Id, default))!.Value.Status);
        // The same operation replays its receipt instead of failing on the existing row.
        Assert.Equal(sample.Id, (await CreateAsync(records, scope, sample, op)).Id);
    }

    [LiveCosmosFact]
    public async Task A_stale_version_conflicts_and_a_failing_batch_leaves_nothing_behind()
    {
        var records = Records();
        var scope = Scope();
        var first = new Sample { Id = Guid.NewGuid().ToString("N"), Status = "Open" };
        await CreateAsync(records, scope, first);
        var row = (await records.ReadAsync<Sample>(scope, "liveSample:" + first.Id, default))!;
        row.Value.Status = "Closed";
        await records.CommitAsync(scope, Op(new { first.Id, Step = 1 }), "live_test.replace", first.Id,
            [RecordChange.Replace("liveSample:" + first.Id, "liveSample", row.Value, row.Version)], new CommandResult { Id = first.Id, Status = "Closed" }, default);
        // The old version is now stale.
        await Assert.ThrowsAsync<DomainException>(() => records.CommitAsync(scope, Op(new { first.Id, Step = 2 }), "live_test.replace", first.Id,
            [RecordChange.Replace("liveSample:" + first.Id, "liveSample", row.Value, row.Version)], new CommandResult { Id = first.Id, Status = "Closed" }, default));

        // One batch creating a new row and re-creating an existing one fails as a whole: the new row is not kept.
        var second = new Sample { Id = Guid.NewGuid().ToString("N"), Status = "Open" };
        await Assert.ThrowsAsync<DomainException>(() => records.CommitAsync(scope, Op(new { second.Id }), "live_test.create_pair", second.Id,
            [RecordChange.Create("liveSample:" + second.Id, "liveSample", second), RecordChange.Create("liveSample:" + first.Id, "liveSample", first)],
            new CommandResult { Id = second.Id, Status = "Open" }, default));
        Assert.Null(await records.ReadAsync<Sample>(scope, "liveSample:" + second.Id, default));
        Assert.Equal("Closed", (await records.ReadAsync<Sample>(scope, "liveSample:" + first.Id, default))!.Value.Status);
    }

    [LiveCosmosFact]
    public async Task A_filtered_page_returns_only_matching_rows_of_its_own_partition()
    {
        var records = Records();
        var scope = Scope();
        foreach (var status in new[] { "Open", "Open", "Closed" })
            await CreateAsync(records, scope, new Sample { Id = Guid.NewGuid().ToString("N"), Status = status });
        await CreateAsync(records, Scope(), new Sample { Id = Guid.NewGuid().ToString("N"), Status = "Open" });

        var page = await records.PageAsync<Sample>(scope, "liveSample", 10, null, default,
            new RecordCondition { Path = "status", Comparison = "eq", Value = "Open" });
        Assert.Equal(2, page.Items.Count);
        Assert.All(page.Items, r => Assert.Equal("Open", r.Value.Status));
    }
}
