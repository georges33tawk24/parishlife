// Purpose: isolates a recipient-partition interruption while preserving real source transactions for notification workflow regressions.
// Main functions: CommitAsync rejects account writes; every source read/query/replay/commit delegates to the actual isolated record store.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.IntegrationTests.Support;

internal sealed class NotificationRecipientFaultRecords(IRecordTransactions inner) : IRecordTransactions
{
    public Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct) => inner.ReadAsync<T>(scope, id, ct);

    public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct, params RecordCondition[] conditions)
        => inner.PageAsync<T>(scope, type, size, continuation, ct, conditions);

    public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
        => inner.ScanWorkAsync<T>(area, type, size, continuation, ct);

    public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class
        => inner.ReplayAsync<T>(scope, operation, ct);

    public Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId, IReadOnlyList<RecordChange> changes,
        T result, CancellationToken ct, string? reason = null) where T : class
        => scope.Area == RecordArea.Account
            ? throw new IOException("Isolated recipient storage interruption")
            : inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
}
