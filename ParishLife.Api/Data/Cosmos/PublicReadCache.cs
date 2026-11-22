// Purpose: an in-memory copy of the anonymous public API answers marked [PublicCache], kept per document store, so a busy public page
// reads Cosmos once per change instead of once per visitor. Every commit through that store to a container public pages read (TenantControl,
// and the platform's published homepage partition in Catalog) clears it at once; anything else a public answer may show (a listed priest's
// display name, configuration) is at most Lifetime old. Sign-ins, sessions and visit counts write elsewhere and do not clear it.
// ponytail: per process; with several app instances, another instance's write shows here after at most Lifetime (60 s). Use a shared
// cache with a change feed if the app scales out and that matters.
// Main members: For (the cache of one store), Changed (called by DocumentBatch after each successful commit), Generation, TryGet, Set.

using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using ParishLife.Api.Configuration;

namespace ParishLife.Api.Data.Cosmos;

internal sealed class PublicReadCache
{
    internal sealed record Entry(byte[] Body, string ContentType, string ETag, long Generation, DateTimeOffset Expires);

    internal static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(60);
    private const int MaximumEntries = 1000;
    private const long MaximumBytes = 32 * 1024 * 1024;

    // One cache per document store instance (one per host), so test hosts with separate stores never share answers.
    private static readonly ConditionalWeakTable<IDocumentDatabase, PublicReadCache> Caches = new();

    private readonly ConcurrentDictionary<string, Entry> entries = new(StringComparer.Ordinal);
    private long generation;
    private long bytes;

    internal static PublicReadCache For(IDocumentDatabase database) => Caches.GetValue(database, _ => new PublicReadCache());

    internal long Generation => Interlocked.Read(ref generation);

    internal void Changed(string container, string key)
    {
        if (container != Containers.TenantControl && !(container == Containers.Catalog && key == "platform:site-content"))
            return;
        Interlocked.Increment(ref generation);
        Clear();
    }

    internal bool TryGet(string request, DateTimeOffset now, out Entry entry)
        => entries.TryGetValue(request, out entry!) && entry.Generation == Generation && entry.Expires > now;

    // An answer computed before a commit that happened while it was being computed is not kept.
    internal void Set(string request, Entry entry)
    {
        if (entry.Generation != Generation)
            return;
        // Keys include the caller-chosen query string, so the bounds are what keep memory finite: count every stored body exactly once
        // (a replaced answer gives its bytes back; a clear starts the count again from this entry).
        if (entries.Count >= MaximumEntries || Interlocked.Read(ref bytes) + entry.Body.Length > MaximumBytes)
            Clear();
        if (entries.TryGetValue(request, out var previous))
            Interlocked.Add(ref bytes, -previous.Body.Length);
        entries[request] = entry;
        Interlocked.Add(ref bytes, entry.Body.Length);
    }

    private void Clear()
    {
        entries.Clear();
        Interlocked.Exchange(ref bytes, 0);
    }
}
