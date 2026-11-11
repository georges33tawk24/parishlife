// Purpose: provides conditional scoped documents and durable receipts using existing configured containers; global platform control uses Catalog.
// Main functions: ReadAsync, ReplayAsync, ScanWorkAsync, PageAsync, CommitAsync, BadCursor.

using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using static ParishLife.Api.Data.Cosmos.JsonDefaults;

namespace ParishLife.Api.Repositories.Common;

internal sealed class RecordTransactions(PartitionDocuments documents, IDataProtectionProvider provider) : IRecordTransactions
{
    private readonly IDataProtector protector = provider.CreateProtector("ParishLife.RecordCursor.v1");
    private sealed record Cursor(RecordScope Scope, string Type, int Size, string Filters, string? Token);
    private static (string Container, string Key) Location(RecordScope scope)
    {
        if (string.IsNullOrWhiteSpace(scope.OwnerId) || scope.OwnerId.Length > 160)
            throw new InvalidOperationException("An exact owner partition is required.");
        return scope.Area switch
        {
            RecordArea.Parish => (Containers.TenantControl, "parish:" + scope.OwnerId),
            RecordArea.Archdiocese => (Containers.TenantControl, "archdiocese:" + scope.OwnerId),
            RecordArea.Finance => ("Finance", "parish:" + scope.OwnerId),
            RecordArea.Resource => (Containers.TenantControl, "resource:" + scope.OwnerId),
            RecordArea.PrivateCase => ("RestrictedCases", "case:" + scope.OwnerId),
            RecordArea.Account => (Containers.Accounts, "account:" + scope.OwnerId),
            RecordArea.Public => ("Publishing", "public:" + scope.OwnerId),
            RecordArea.Platform => (Containers.Catalog, "platform:" + scope.OwnerId),
            _ => throw new InvalidOperationException("Unsupported transaction scope.")
        };
    }

    public Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct)
    {
        var (container, key) = Location(scope);
        return documents.ReadAsync<T>(container, key, id, ct);
    }

    public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct)
        where T : class
    {
        var (container, key) = Location(scope);
        return documents.ReplayAsync<T>(container, key, operation, ct);
    }

    public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
    {
        // Non-runtime exceptions: the platform CRM worklist (Platform area only) and personal report schedules (Account area only).
        if (type is not ("reservationWork" or "backgroundJob" or "notificationWork" or "subscriptionWork")
            && !(type == "parishCrmRecord" && area == RecordArea.Platform) && !(type == "reportSchedule" && area == RecordArea.Account))
            throw new InvalidOperationException("Only runtime-owned due-work types and the platform CRM worklist can be scanned across partitions.");
        var (container, _) = Location(new RecordScope { Area = area, OwnerId = "worker" });
        var query = StorageQuery.Type(type);
        if (type == "reservationWork")
            query = query.Where(StorageFilter.Or(StorageFilter.Eq("data.status", "Allocating"),
            StorageFilter.Or(StorageFilter.Eq("data.status", "Cancelling"), StorageFilter.Eq("data.status", "Compensating"))));
        if (type == "notificationWork")
            query = query.Where(StorageFilter.Eq("data.status", "Pending"));
        if (type == "reportSchedule")
            query = query.Where(StorageFilter.Eq("data.status", "Active"));
        return documents.QueryPageAsync<T>(container, null, query, Math.Clamp(size, 1, 100), continuation, ct);
    }

    public async Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct, params RecordCondition[] conditions)
    {
        if (size is < 1 or > 100 || conditions.Length > 20)
            throw new DomainException("invalid_page", "Use 1–100 rows and bounded typed filters.");
        var fingerprint = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(conditions, Options)));
        string? raw = null;
        if (continuation is not null)
        {
            if (continuation.Length > 65536)
                throw BadCursor();
            try
            {
                var cursor = JsonSerializer.Deserialize<Cursor>(protector.Unprotect(continuation), Options);
                if (cursor is null || cursor.Scope.Area != scope.Area || cursor.Scope.OwnerId != scope.OwnerId
                    || cursor.Type != type || cursor.Size != size || cursor.Filters != fingerprint)
                    throw BadCursor();
                raw = cursor.Token;
            }
            catch (Exception ex) when (ex is CryptographicException or JsonException or FormatException)
            {
                throw BadCursor();
            }
        }

        var query = StorageQuery.Type(type);
        foreach (var condition in conditions)
            query = query.Where(condition.Comparison switch
            {
                "eq" => StorageFilter.Eq("data." + condition.Path, condition.Value),
                "lt" => StorageFilter.Lt("data." + condition.Path, condition.Value!),
                "lte" => StorageFilter.Lte("data." + condition.Path, condition.Value!),
                "gt" => StorageFilter.Gt("data." + condition.Path, condition.Value!),
                "in" when condition.Value is string[] { Length: > 0 and <= 10 } values => StorageFilter.Or(values.Select(value => StorageFilter.Eq("data." + condition.Path, value)).ToArray()),
                _ => throw new InvalidOperationException("Unsupported server query condition.")
            });
        var (container, key) = Location(scope);
        var page = await documents.QueryPageAsync<T>(container, key, query, size, raw, ct);
        return new Page<Versioned<T>>
        {
            Items = page.Items,
            ContinuationToken = page.ContinuationToken is null ? null : protector.Protect(JsonSerializer.Serialize(new Cursor(scope, type, size, fingerprint, page.ContinuationToken), Options))
        };
    }

    public async Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId, IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null)
        where T : class
    {
        var (container, key) = Location(scope);
        if (await documents.ReplayAsync<T>(container, key, operation, ct) is { } prior)
            return prior;
        if (changes.Count > 98)
            throw new DomainException("batch_limit", "Split this operation into a resumable job.");
        var batch = documents.Batch(container, key);
        foreach (var change in changes)
        {
            var row = Row(change.Id, key, change.Type, change.Value);
            switch (change.Action)
            {
                case "create":
                    batch.CreateItem(row);
                    break;
                case "replace":
                    batch.ReplaceItem(change.Id, row, PartitionDocuments.Match(Versions.Require(change.ExpectedVersion)));
                    break;
                case "delete":
                    batch.DeleteItem(change.Id, Versions.Require(change.ExpectedVersion));
                    break;
                default:
                    throw new InvalidOperationException("Unsupported internal document mutation.");
            }
        }

        batch.CreateItem(Receipt(key, operation, result)).CreateItem(Audit(key, operation, action, resourceId, reason));
        try
        {
            await documents.CommitAsync(batch, ct);
            return result;
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            var committed = await documents.ReplayAsync<T>(container, key, operation, ct);
            if (committed is not null)
                return committed;
            throw;
        }
    }

    private static DomainException BadCursor() => new("invalid_cursor", "The cursor does not match this authorized scope/query.");
}
