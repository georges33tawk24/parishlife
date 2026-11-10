// Purpose: verifies source-authorized notification outcome aggregation through isolated real parish storage and faulted point reads.
// Main tests: legacy/no-notice distinctions, mixed outcomes, missing/corrupt work, storage failure/cancellation, bounded reads and private DTO shape.
// Source authorization belongs to feature callers and is tested by their HTTP scenarios; this helper creates no standalone feed.

using System.Text.Json;
using RequestFailedException = Azure.RequestFailedException;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class NotificationOutcomeReaderTests
{
    [Fact]
    public async Task Legacy_and_explicitly_unnecessary_notices_are_distinct_without_storage_reads()
    {
        await using var f = new LocalBackendFixture();
        var observed = new ObservedRecords(f.Services.GetRequiredService<IRecordTransactions>());
        var reader = new NotificationOutcomeReader(observed);
        var parish = Guid.NewGuid().ToString("N");

        Assert.Equal("NotTracked", (await reader.ReadAsync(parish, null, default)).Status);
        Assert.Equal("NotRequired", (await reader.ReadAsync(parish, [], default)).Status);
        Assert.Equal(0, observed.Reads);
    }

    [Theory]
    [InlineData("Stored", "Stored", "Stored")]
    [InlineData("Pending", "Pending", "Pending")]
    [InlineData("Stored", "Pending", "Pending")]
    [InlineData("Pending", "Stored", "Pending")]
    public async Task Only_confirmed_saved_outcomes_report_stored_and_mixed_pending_stays_pending(string first, string second, string expected)
    {
        await using var f = new LocalBackendFixture();
        var parish = Guid.NewGuid().ToString("N");
        var a = Work(f, parish, first);
        var b = Work(f, parish, second);
        await SaveAsync(f, parish, Change(a), Change(b));

        var outcome = await f.Services.GetRequiredService<NotificationOutcomeReader>().ReadAsync(parish, [a.Id, b.Id], default);

        Assert.Equal(expected, outcome.Status);
        if (expected == "Pending") Assert.Contains("may already", outcome.Meaning);
        else Assert.Contains("in the app", outcome.Meaning);
    }

    [Theory]
    [InlineData("Missing")]
    [InlineData("WrongParish")]
    [InlineData("WrongId")]
    [InlineData("UnknownStatus")]
    [InlineData("UnknownIdentity")]
    public async Task A_missing_or_invalid_saved_outcome_never_makes_a_mixed_batch_appear_stored(string defect)
    {
        await using var f = new LocalBackendFixture();
        var parish = Guid.NewGuid().ToString("N");
        var good = Work(f, parish, "Stored");
        var bad = Work(f, parish, "Stored");
        var requestedId = bad.Id;
        if (defect == "WrongParish") bad.ParishId = Guid.NewGuid().ToString("N");
        if (defect == "WrongId") bad.Id = Guid.NewGuid().ToString("N");
        if (defect == "UnknownStatus") bad.Status = "Delivered";
        if (defect == "UnknownIdentity") bad.IdentityVersion = 3;
        var changes = new List<RecordChange> { Change(good) };
        if (defect != "Missing") changes.Add(RecordChange.Create("notificationWork:" + requestedId, "notificationWork", bad));
        await SaveAsync(f, parish, changes.ToArray());

        Assert.Equal("Unconfirmed", (await f.Services.GetRequiredService<NotificationOutcomeReader>()
            .ReadAsync(parish, [good.Id, requestedId], default)).Status);
    }

    [Theory]
    [InlineData("IO")]
    [InlineData("AzurePermission")]
    [InlineData("UnexpectedReadFailure")]
    [InlineData("ProviderCancellation")]
    public async Task Failed_point_reads_return_only_an_unconfirmed_outcome(string failure)
    {
        await using var f = new LocalBackendFixture();
        Exception fault = failure switch
        {
            "IO" => new IOException("Private storage location must not reach the response"),
            "AzurePermission" => new RequestFailedException(403, "Private provider diagnostic", "AuthorizationPermissionMismatch", null),
            "ProviderCancellation" => new OperationCanceledException(new CancellationToken(canceled: true)),
            _ => new InvalidOperationException("Private reader diagnostic")
        };
        var observed = new ObservedRecords(f.Services.GetRequiredService<IRecordTransactions>(), (_, _, _) => throw fault);
        var outcome = await new NotificationOutcomeReader(observed).ReadAsync(Guid.NewGuid().ToString("N"), [Guid.NewGuid().ToString("N")], default);

        Assert.Equal("Unconfirmed", outcome.Status);
        Assert.Equal(1, observed.Reads);
        Assert.DoesNotContain("Private", outcome.Meaning);
    }

    [Fact]
    public async Task Caller_cancellation_before_or_during_a_read_propagates()
    {
        await using var f = new LocalBackendFixture();
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var parish = Guid.NewGuid().ToString("N");
        using var before = new CancellationTokenSource();
        before.Cancel();
        var untouched = new ObservedRecords(records);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => new NotificationOutcomeReader(untouched).ReadAsync(parish, null, before.Token));
        Assert.Equal(0, untouched.Reads);

        using var during = new CancellationTokenSource();
        var interrupted = new ObservedRecords(records, (_, _, _) => { during.Cancel(); return Task.CompletedTask; });
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => new NotificationOutcomeReader(interrupted)
            .ReadAsync(parish, [Guid.NewGuid().ToString("N")], during.Token));
        Assert.Equal(1, interrupted.Reads);
    }

    [Fact]
    public async Task Point_reads_are_bounded_and_duplicate_pointers_do_not_expand_them()
    {
        await using var f = new LocalBackendFixture();
        var parish = Guid.NewGuid().ToString("N");
        var work = Enumerable.Range(0, 40).Select(_ => Work(f, parish, "Stored")).ToArray();
        await SaveAsync(f, parish, work.Select(Change).ToArray());
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var bounded = new ObservedRecords(records);
        Assert.Equal("Stored", (await new NotificationOutcomeReader(bounded).ReadAsync(parish, work.Select(w => w.Id).ToArray(), default)).Status);
        Assert.Equal(40, bounded.Reads);
        var duplicate = new ObservedRecords(records);
        Assert.Equal("Stored", (await new NotificationOutcomeReader(duplicate).ReadAsync(parish, Enumerable.Repeat(work[0].Id, 40).ToArray(), default)).Status);
        Assert.Equal(1, duplicate.Reads);
        var refused = new ObservedRecords(records);
        var reader = new NotificationOutcomeReader(refused);
        Assert.Equal("Unconfirmed", (await reader.ReadAsync(parish, Enumerable.Repeat(work[0].Id, 41).ToArray(), default)).Status);
        Assert.Equal("Unconfirmed", (await reader.ReadAsync(parish, [work[0].Id, "not-a-work-pointer"], default)).Status);
        Assert.Equal(0, refused.Reads);
    }

    [Fact]
    public async Task Source_outcome_json_has_no_recipient_counts_topics_or_internal_identifiers()
    {
        await using var f = new LocalBackendFixture();
        var parish = Guid.NewGuid().ToString("N");
        var work = Work(f, parish, "Stored");
        work.Title = "Private fixture title";
        work.Topic = "Private fixture topic";
        await SaveAsync(f, parish, Change(work));
        var outcome = await f.Services.GetRequiredService<NotificationOutcomeReader>().ReadAsync(parish, [work.Id], default);
        var json = JsonSerializer.SerializeToElement(outcome, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Equal(new[] { "meaning", "status" }, json.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray());
        var text = json.GetRawText();
        Assert.DoesNotContain(work.Id, text);
        Assert.DoesNotContain(work.AccountId, text);
        Assert.DoesNotContain(work.ParishId, text);
        Assert.DoesNotContain(work.Topic, text);
        Assert.DoesNotContain(work.Title, text);
    }

    private static NotificationWork Work(LocalBackendFixture f, string parish, string status)
    {
        var staged = f.Services.GetRequiredService<NotificationService>().StageRequired(parish, Guid.NewGuid().ToString("N"), "fixture.outcome",
            "There is an update.", null, "outcome:" + Guid.NewGuid().ToString("N"), "ParishOwner", parish, f.Clock.Now);
        var work = (NotificationWork)staged.Value!;
        work.Status = status;
        return work;
    }

    private static RecordChange Change(NotificationWork work) => RecordChange.Create("notificationWork:" + work.Id, "notificationWork", work);

    private static async Task SaveAsync(LocalBackendFixture f, string parish, params RecordChange[] changes)
    {
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish };
        await f.Services.GetRequiredService<IRecordTransactions>().CommitAsync(scope,
            Operation.Create(Guid.NewGuid(), "isolated-outcome-fixture", new { parish }, f.Clock), "test.notification-outcomes", parish,
            changes, new CommandResult { Status = "Saved" }, default);
    }

    private sealed class ObservedRecords(IRecordTransactions inner, Func<RecordScope, string, CancellationToken, Task>? beforeRead = null) : IRecordTransactions
    {
        internal int Reads { get; private set; }
        public async Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct)
        {
            Reads++;
            if (beforeRead is not null) await beforeRead(scope, id, ct);
            return await inner.ReadAsync<T>(scope, id, ct);
        }
        public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct, params RecordCondition[] conditions)
            => throw new InvalidOperationException("Outcome aggregation must not query a feed.");
        public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
            => throw new InvalidOperationException("Outcome aggregation must not scan pending work.");
        public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class => inner.ReplayAsync<T>(scope, operation, ct);
        public Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId, IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null) where T : class
            => inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
    }
}
