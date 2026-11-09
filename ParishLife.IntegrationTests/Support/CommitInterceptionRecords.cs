// Purpose: injects one controlled concurrent change immediately before a real isolated transaction commits.
// Main functions: CommitAsync invokes the one-shot callback; all other operations delegate to the actual record store.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.IntegrationTests.Support;

internal sealed class CommitInterceptionRecords(IRecordTransactions inner, Func<Task> beforeCommit) : IRecordTransactions
{
    private bool intercepted;

    public Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct)
        => inner.ReadAsync<T>(scope, id, ct);

    public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation,
        CancellationToken ct, params RecordCondition[] conditions)
        => inner.PageAsync<T>(scope, type, size, continuation, ct, conditions);

    public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
        => inner.ScanWorkAsync<T>(area, type, size, continuation, ct);

    public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class
        => inner.ReplayAsync<T>(scope, operation, ct);

    public async Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId,
        IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null) where T : class
    {
        if (!intercepted)
        {
            intercepted = true;
            await beforeCommit();
        }
        return await inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
    }
}
