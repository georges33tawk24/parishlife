// Purpose: Provides explicit Development-only document files with partition locks, conditional writes, and atomic
// file replacement.
// Main functions: DirectoryFor, PathFor, LockAsync, LoadAsync, ReadAsync, QueryAsync, CommitAsync.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Data.Local;

internal sealed class LocalDocumentDatabase(string root) : IDocumentDatabase
{
    private sealed record Partition(string Key, Dictionary<string, StoredRow> Items);
    private string DirectoryFor(string container)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(container, @"\A[A-Za-z][A-Za-z0-9_-]*\z"))
            throw new InvalidOperationException("Invalid internal container.");
        var path = Path.Combine(root, "documents", container);
        Directory.CreateDirectory(path);
        return path;
    }

    private string PathFor(string container, string key) => Path.Combine(DirectoryFor(container), Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))) + ".json");
    private static async Task<FileStream> LockAsync(string path, CancellationToken ct)
    {
        var deadline = DateTime.UtcNow.AddSeconds(30);
        while (true)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                return new FileStream(path + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            }
            catch (IOException) when (DateTime.UtcNow < deadline)
            {
                await Task.Delay(20, ct);
            }
        }
    }

    private static async Task<Partition> LoadAsync(string path, string key, CancellationToken ct)
    {
        if (!File.Exists(path))
            return new(key, []);
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        var data = await JsonSerializer.DeserializeAsync<Partition>(stream, JsonDefaults.Options, ct) ?? throw new DomainException("local_data_unreadable", "Local storage needs operator recovery.", FailureKind.Unavailable);
        if (data.Key != key)
            throw new InvalidOperationException("Partition identity mismatch.");
        return data;
    }

    public async Task<StoredRow?> ReadAsync(string container, string key, string id, CancellationToken ct)
    {
        var path = PathFor(container, key);
        await using var held = await LockAsync(path, ct);
        return (await LoadAsync(path, key, ct)).Items.GetValueOrDefault(id);
    }

    public async Task<StoredPage> QueryAsync(string container, string? key, StorageQuery query, int size, string? continuation, CancellationToken ct)
    {
        if (size is < 1 or > 1000)
            throw new InvalidOperationException("Queries must be bounded.");
        var rows = new List<(string Sort, StoredRow Row)>();
        var files = key is null ? Directory.GetFiles(DirectoryFor(container), "*.json") : [PathFor(container, key)];
        foreach (var path in files)
        {
            await using var held = await LockAsync(path, ct);
            if (!File.Exists(path))
                continue;
            await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var partition = await JsonSerializer.DeserializeAsync<Partition>(stream, JsonDefaults.Options, ct) ?? throw new DomainException("local_data_unreadable", "Local storage needs operator recovery.", FailureKind.Unavailable);
            foreach (var item in partition.Items)
            {
                var sort = key is null ? partition.Key + "\0" + item.Key : item.Key;
                if ((continuation is null || string.CompareOrdinal(sort, continuation) > 0) && query.Filter.Matches(item.Value.Document))
                    rows.Add((sort, item.Value));
            }
        }

        var page = rows.OrderBy(r => r.Sort, StringComparer.Ordinal).Take(size + 1).ToArray();
        return new(page.Take(size).Select(r => r.Row).ToArray(), page.Length > size ? page[size - 1].Sort : null);
    }

    public async Task<IReadOnlyList<string>> CommitAsync(string container, string key, IReadOnlyList<DocumentMutation> mutations, CancellationToken ct)
    {
        var path = PathFor(container, key);
        await using var held = await LockAsync(path, ct);
        var partition = await LoadAsync(path, key, ct);
        var next = new Dictionary<string, StoredRow>(partition.Items, StringComparer.Ordinal);
        var versions = new List<string>();
        foreach (var mutation in mutations)
        {
            var current = next.GetValueOrDefault(mutation.Id);
            if ((mutation.Action == "create" && current is not null) || (mutation.Action is "replace" or "delete" && current is null) || (mutation.ExpectedVersion is not null && current?.Version != mutation.ExpectedVersion))
                throw new DomainException("write_conflict", "The current version or unique identifier changed.", FailureKind.Conflict);
            var version = '"' + Guid.NewGuid().ToString("N") + '"';
            versions.Add(version);
            if (mutation.Action == "delete")
                next.Remove(mutation.Id);
            else
                next[mutation.Id] = new(mutation.Document!.Value.Clone(), version);
        }

        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 8192, FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, new Partition(key, next), JsonDefaults.Options, ct);
                await stream.FlushAsync(ct);
                stream.Flush(true);
            }

            File.Move(temporary, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary))
                File.Delete(temporary);
        }

        return versions;
    }
}
