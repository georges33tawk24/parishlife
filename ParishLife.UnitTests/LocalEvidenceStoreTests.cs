// Purpose: verifies immutable local evidence publication across independent store instances without Azure or production data.
// Main tests: identical concurrent writes and complete reads, conflicting concurrent bytes, cancellation and temporary-file cleanup.

using ParishLife.Api.Data.Local;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using Xunit;

namespace ParishLife.Tests;

public class LocalEvidenceStoreTests
{
    [Fact]
    public async Task Independent_stores_accept_identical_concurrent_writes_and_expose_only_complete_content()
    {
        using var folder = new EvidenceFolder();
        var content = new byte[2 * 1024 * 1024];
        Random.Shared.NextBytes(content);
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var writes = Enumerable.Range(0, 6).Select(async _ =>
        {
            await start.Task;
            await new LocalEvidenceStore(folder.Root).PutAsync("parish/operation", content, "application/pdf", default);
        }).ToArray();
        var finished = Task.WhenAll(writes);
        var reader = new LocalEvidenceStore(folder.Root);
        var incomplete = false;
        start.SetResult();
        try
        {
            while (!finished.IsCompleted)
            {
                var visible = await reader.OpenAsync("parish/operation", default);
                incomplete |= visible is not null && !visible.AsSpan().SequenceEqual(content);
                await Task.Yield();
            }
        }
        finally { await finished; }

        Assert.False(incomplete);
        Assert.Equal(content, await reader.OpenAsync("parish/operation", default));
        Assert.Empty(Directory.EnumerateFiles(folder.Root, "*.tmp", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task Different_same_length_concurrent_content_has_one_winner_and_never_overwrites_it()
    {
        using var folder = new EvidenceFolder();
        byte[][] choices = ["first immutable evidence"u8.ToArray(), "other immutable evidence"u8.ToArray()];
        Assert.Equal(choices[0].Length, choices[1].Length);
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var writes = choices.Select(async content =>
        {
            await start.Task;
            return await Record.ExceptionAsync(() => new LocalEvidenceStore(folder.Root).PutAsync("parish/operation", content, "application/pdf", default));
        }).ToArray();
        start.SetResult();
        var outcomes = await Task.WhenAll(writes);
        Assert.Single(outcomes, error => error is null);
        var conflict = Assert.Single(outcomes.OfType<DomainException>());
        Assert.Equal(("evidence_content_conflict", FailureKind.Conflict), (conflict.Code, conflict.Kind));
        var winningBytes = choices[Array.FindIndex(outcomes, error => error is null)];
        Assert.Equal(winningBytes, await new LocalEvidenceStore(folder.Root).OpenAsync("parish/operation", default));
        Assert.Empty(Directory.EnumerateFiles(folder.Root, "*.tmp", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task Cancelled_writes_publish_nothing_and_remove_their_unpublished_temporary_file()
    {
        using var folder = new EvidenceFolder();
        var store = new LocalEvidenceStore(folder.Root);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => store.PutAsync("parish/operation", new byte[1024], "application/pdf", cancellation.Token));

        Assert.Null(await store.OpenAsync("parish/operation", default));
        Assert.Empty(Directory.EnumerateFiles(folder.Root, "*.tmp", SearchOption.AllDirectories));
    }

    private sealed class EvidenceFolder : IDisposable
    {
        private const string Prefix = "ParishLife-EvidenceStore-";
        internal string Root { get; } = Path.Combine(Path.GetTempPath(), Prefix + Guid.NewGuid().ToString("N"));

        internal EvidenceFolder() => Directory.CreateDirectory(Root);

        public void Dispose()
        {
            var full = Path.GetFullPath(Root);
            var temporaryRoot = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (!string.Equals(Path.GetDirectoryName(full), temporaryRoot, StringComparison.OrdinalIgnoreCase)
                || !Path.GetFileName(full).StartsWith(Prefix, StringComparison.Ordinal))
                throw new InvalidOperationException("The isolated evidence fixture escaped its temporary directory.");
            Directory.Delete(full, recursive: true);
        }
    }
}
