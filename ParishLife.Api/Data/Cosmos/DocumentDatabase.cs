// Purpose: Runs Cosmos point reads and bounded queries/batches inside one complete container/partition transaction
// boundary.
// Main functions: CreateItem, UpsertItem, ReplaceItem, DeleteItem, Add, ExecuteAsync, Dispose, Container,
// ReadAsync, QueryAsync, CommitAsync.

using System.Net;
using System.Text.Json;
using Microsoft.Azure.Cosmos;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Data.Cosmos;

internal sealed record DocumentMutation(string Action, string Id, JsonElement? Document, string? ExpectedVersion);
internal sealed record StoredRow(JsonElement Document, string Version);
internal sealed record StoredPage(IReadOnlyList<StoredRow> Items, string? Continuation);
internal interface IDocumentDatabase
{
    Task<StoredRow?> ReadAsync(string container, string key, string id, CancellationToken ct);
    Task<StoredPage> QueryAsync(string container, string? key, StorageQuery query, int size, string? continuation, CancellationToken ct);
    Task<IReadOnlyList<string>> CommitAsync(string container, string key, IReadOnlyList<DocumentMutation> mutations, CancellationToken ct);
}

internal sealed class DocumentBatch(IDocumentDatabase database, string container, string key)
{
    private readonly List<DocumentMutation> mutations = [];
    public DocumentBatch CreateItem<T>(Document<T> document)
    {
        Add("create", document.Id, document, null);
        return this;
    }

    public DocumentBatch UpsertItem<T>(Document<T> document)
    {
        Add("upsert", document.Id, document, null);
        return this;
    }

    public DocumentBatch ReplaceItem<T>(string id, Document<T> document, TransactionalBatchItemRequestOptions? options = null)
    {
        Add("replace", id, document, options?.IfMatchEtag);
        return this;
    }

    public DocumentBatch DeleteItem(string id, string expected)
    {
        mutations.Add(new("delete", id, null, expected));
        return this;
    }

    private void Add<T>(string action, string id, Document<T> value, string? expected)
    {
        if (value.PartitionKey != key || value.Id != id)
            throw new InvalidOperationException("A batch must use one complete partition and exact item IDs.");
        mutations.Add(new(action, id, JsonSerializer.SerializeToElement(value, JsonDefaults.Options), expected));
    }

    public async Task<BatchOutcome> ExecuteAsync(CancellationToken ct)
    {
        if (mutations.Count is < 1 or > 100 || JsonSerializer.SerializeToUtf8Bytes(mutations, JsonDefaults.Options).Length > 2 * 1024 * 1024)
            throw new DomainException("batch_limit", "The atomic operation exceeds its bounded document transaction.");
        try
        {
            return new(HttpStatusCode.OK, await database.CommitAsync(container, key, mutations, ct));
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            return new(HttpStatusCode.PreconditionFailed, []);
        }
    }
}

internal sealed class BatchOutcome(HttpStatusCode status, IReadOnlyList<string> versions) : IDisposable
{
    public HttpStatusCode StatusCode { get; } = status;
    public bool IsSuccessStatusCode => (int)StatusCode is >= 200 and < 300;

    public BatchItem this[int index] => new(versions[index]);
    public void Dispose()
    {
    }

    internal sealed record BatchItem(string ETag);
}

internal sealed class CosmosDocumentDatabase(CosmosClient client, string database) : IDocumentDatabase
{
    private Container Container(string name) => client.GetContainer(database, name);
    public async Task<StoredRow?> ReadAsync(string container, string key, string id, CancellationToken ct)
    {
        try
        {
            var response = await Container(container).ReadItemAsync<JsonElement>(id, new PartitionKey(key), cancellationToken: ct);
            return new(response.Resource, response.ETag);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<StoredPage> QueryAsync(string container, string? key, StorageQuery query, int size, string? continuation, CancellationToken ct)
    {
        using var iterator = Container(container).GetItemQueryIterator<JsonElement>(query.ToCosmos(), continuation, new QueryRequestOptions { PartitionKey = key is null ? null : new PartitionKey(key), MaxItemCount = size, ResponseContinuationTokenLimitInKb = 2 });
        var response = await iterator.ReadNextAsync(ct);
        return new(response.Select(row => new StoredRow(row, row.GetProperty("_etag").GetString()!)).ToArray(), response.ContinuationToken);
    }

    public async Task<IReadOnlyList<string>> CommitAsync(string container, string key, IReadOnlyList<DocumentMutation> mutations, CancellationToken ct)
    {
        var batch = Container(container).CreateTransactionalBatch(new PartitionKey(key));
        foreach (var mutation in mutations)
            switch (mutation.Action)
            {
                case "create":
                    batch.CreateItem(mutation.Document!.Value);
                    break;
                case "upsert":
                    batch.UpsertItem(mutation.Document!.Value);
                    break;
                case "replace":
                    batch.ReplaceItem(mutation.Id, mutation.Document!.Value, new() { IfMatchEtag = mutation.ExpectedVersion });
                    break;
                case "delete":
                    batch.DeleteItem(mutation.Id, new() { IfMatchEtag = mutation.ExpectedVersion });
                    break;
            }

        using var response = await batch.ExecuteAsync(ct);
        if (response.IsSuccessStatusCode)
            return Enumerable.Range(0, mutations.Count).Select(i => response[i].ETag).ToArray();
        if (response.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.PreconditionFailed || response.Any(r => r.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.PreconditionFailed))
            throw new DomainException("write_conflict", "The current version or unique identifier changed.", FailureKind.Conflict);
        throw new DomainException("persistence_unavailable", "The operation outcome is unknown. Check before retrying with the same operation ID.", FailureKind.Unavailable);
    }
}
