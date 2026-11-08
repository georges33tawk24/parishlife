// Purpose: Reads versioned document envelopes and commits/replays bounded operations with ETag concurrency.
// Main functions: ReadAsync, Decode, ReplayAsync, Batch, CommitAsync, CreateAsync, ReplaceAsync, QueryPageAsync,
// QueryAsync, Match.

using System.Text.Json;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Data.Cosmos;

internal sealed class PartitionDocuments
{
    private readonly IDocumentDatabase database;
    internal PartitionDocuments(IDocumentDatabase database)
    {
        this.database = database;
    }

    internal PartitionDocuments(CosmosClient client, IOptions<CosmosOptions> options) : this(new CosmosDocumentDatabase(client, options.Value.Database))
    {
    }

    internal async Task<Versioned<T>?> ReadAsync<T>(string container, string key, string id, CancellationToken ct)
    {
        var stored = await database.ReadAsync(container, key, id, ct);
        return stored is null ? null : Decode<T>(stored);
    }

    private static Versioned<T> Decode<T>(StoredRow row)
    {
        var document = row.Document.Deserialize<Document<T>>(JsonDefaults.Options);
        if (document?.SchemaVersion != 1)
            throw new DomainException("unsupported_document_version", "A supported document upgrade is required.", FailureKind.Unavailable);
        return new Versioned<T>
        {
            Value = document.Data,
            Version = row.Version
        };
    }

    internal async Task<T?> ReplayAsync<T>(string container, string key, Operation operation, CancellationToken ct)
        where T : class
    {
        var prior = await ReadAsync<OperationReceipt>(container, key, "operation:" + operation.Id, ct);
        if (prior is null)
            return null;
        if (prior.Value.ActorId != operation.ActorId || prior.Value.Fingerprint != operation.Fingerprint)
            throw new DomainException("operation_reused", "This operation ID already belongs to different input or another actor.", FailureKind.Conflict);
        return prior.Value.Result.Deserialize<T>(JsonDefaults.Options) ?? throw new DomainException("operation_unreadable", "The saved operation needs a compatible reader.", FailureKind.Unavailable);
    }

    internal DocumentBatch Batch(string container, string key) => new(database, container, key);
    internal async Task CommitAsync(DocumentBatch batch, CancellationToken ct)
    {
        using var response = await batch.ExecuteAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new DomainException("write_conflict", "The current version or unique identifier changed.", FailureKind.Conflict);
    }

    internal async Task<Versioned<T>> CreateAsync<T>(string container, Document<T> document, CancellationToken ct)
    {
        using var response = await Batch(container, document.PartitionKey).CreateItem(document).ExecuteAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new DomainException("write_conflict", "The identifier already exists.", FailureKind.Conflict);
        return new Versioned<T>
        {
            Value = document.Data,
            Version = response[0].ETag
        };
    }

    internal async Task<Versioned<T>> ReplaceAsync<T>(string container, Document<T> document, string version, CancellationToken ct)
    {
        using var response = await Batch(container, document.PartitionKey).ReplaceItem(document.Id, document, Match(version)).ExecuteAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new DomainException("write_conflict", "The current version changed.", FailureKind.Conflict);
        return new Versioned<T>
        {
            Value = document.Data,
            Version = response[0].ETag
        };
    }

    internal async Task<Page<Versioned<T>>> QueryPageAsync<T>(string container, string? key, StorageQuery query, int size, string? continuation, CancellationToken ct)
    {
        var page = await database.QueryAsync(container, key, query, size, continuation, ct);
        return new Page<Versioned<T>>
        {
            Items = page.Items.Select(Decode<T>).ToArray(),
            ContinuationToken = page.Continuation
        };
    }

    internal async Task<IReadOnlyList<T>> QueryAsync<T>(string container, string? key, StorageQuery query, CancellationToken ct, int limit = 500)
    {
        var result = new List<T>();
        string? continuation = null;
        do
        {
            var page = await QueryPageAsync<T>(container, key, query, Math.Min(limit, 100), continuation, ct);
            result.AddRange(page.Items.Select(x => x.Value));
            continuation = page.ContinuationToken;
            if (result.Count > limit)
                throw new DomainException("query_bound_exceeded", "Use the paged or background operation for this dataset.", FailureKind.Unavailable);
        }
        while (continuation is not null);
        return result;
    }

    internal static TransactionalBatchItemRequestOptions Match(string version) => new()
    {
        IfMatchEtag = version
    };
}
