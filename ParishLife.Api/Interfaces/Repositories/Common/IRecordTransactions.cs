// Purpose: Declares the IRecordTransactions boundary used by backend services without exposing provider
// implementation details.
// Main functions: ReadAsync, PageAsync, ScanWorkAsync, ReplayAsync, CommitAsync.

using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Interfaces.Repositories.Common;

public interface IRecordTransactions
{
    Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct);
    Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct, params RecordCondition[] conditions);
    Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct);
    Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct)
        where T : class;
    Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId, IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null)
        where T : class;
}
