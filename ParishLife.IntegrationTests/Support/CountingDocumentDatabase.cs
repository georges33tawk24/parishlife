// Purpose: test-only decorator that counts the document operations one HTTP request makes (point reads, query pages, commits), so
// request cost (N+1 reads, per-request authentication reads) can be measured and held to a ceiling. Never registered outside tests.
// Main members: Reads, Queries, Commits, Log (what was read, to spot repeated reads), Reset; every IDocumentDatabase call delegates to the real local store.

using ParishLife.Api.Data.Cosmos;

namespace ParishLife.IntegrationTests.Support;

internal sealed class CountingDocumentDatabase(IDocumentDatabase inner) : IDocumentDatabase
{
    private int reads, queries, commits;

    public int Reads => reads;

    public int Queries => queries;

    public int Commits => commits;

    public List<string> Log { get; } = [];

    public void Reset()
    {
        reads = queries = commits = 0;
        lock (Log)
            Log.Clear();
    }

    private void Note(string entry)
    {
        lock (Log)
            Log.Add(entry);
    }

    public Task<StoredRow?> ReadAsync(string container, string key, string id, CancellationToken ct)
    {
        Interlocked.Increment(ref reads);
        Note($"read {container} {key.Split(':')[0]} {id.Split(':')[0]}");
        return inner.ReadAsync(container, key, id, ct);
    }

    public Task<StoredPage> QueryAsync(string container, string? key, StorageQuery query, int size, string? continuation, CancellationToken ct)
    {
        Interlocked.Increment(ref queries);
        Note($"query {container} {key?.Split(':')[0] ?? "cross-partition"} {string.Join(",", query.Filter.Paths())}");
        return inner.QueryAsync(container, key, query, size, continuation, ct);
    }

    public Task<IReadOnlyList<string>> CommitAsync(string container, string key, IReadOnlyList<DocumentMutation> mutations, CancellationToken ct)
    {
        Interlocked.Increment(ref commits);
        return inner.CommitAsync(container, key, mutations, ct);
    }

    public Task<IReadOnlyList<string>> ContainersAsync(CancellationToken ct) => inner.ContainersAsync(ct);
}
