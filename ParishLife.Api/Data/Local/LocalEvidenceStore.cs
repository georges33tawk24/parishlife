// Purpose: keeps evidence files under the local development storage folder; used only with the Local storage provider.
// Main functions: PutAsync publishes complete temporary content or verifies existing bytes; OpenAsync uses the same cross-process lock to read it.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Data.Local;

internal sealed class LocalEvidenceStore(string root) : IEvidenceStore
{
    private string Full(string path)
    {
        var full = Path.GetFullPath(Path.Combine(root, "evidence", path));
        return full.StartsWith(Path.GetFullPath(Path.Combine(root, "evidence")) + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            ? full : throw new InvalidOperationException("Evidence path escapes the storage folder.");
    }

    public async Task PutAsync(string path, byte[] content, string contentType, CancellationToken ct)
    {
        var full = Full(path);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        var temporary = full + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 8192, FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await file.WriteAsync(content, ct);
                await file.FlushAsync(ct);
                file.Flush(flushToDisk: true);
            }

            // All instances coordinate publication; this also avoids relying on Unix File.Move's existence-check/rename fast path.
            await using var held = await LockAsync(full, ct);
            if (File.Exists(full))
            {
                var existing = await File.ReadAllBytesAsync(full, ct);
                if (!existing.AsSpan().SequenceEqual(content))
                    throw new DomainException("evidence_content_conflict", "This evidence location already contains different content.", FailureKind.Conflict);
                return;
            }
            ct.ThrowIfCancellationRequested();
            File.Move(temporary, full, overwrite: false);
        }
        finally
        {
            // Only this unpublished attempt is removed; an existing evidence object is never changed or deleted.
            File.Delete(temporary);
        }
    }

    public async Task<byte[]?> OpenAsync(string path, CancellationToken ct)
    {
        var full = Full(path);
        try
        {
            // Do not create missing directories for a read; the publication lock prevents reads racing a Windows file move.
            await using var held = await LockAsync(full, ct);
            return await File.ReadAllBytesAsync(full, ct);
        }
        catch (FileNotFoundException) { return null; }
        catch (DirectoryNotFoundException) { return null; }
    }

    private static async Task<FileStream> LockAsync(string path, CancellationToken ct)
    {
        var deadline = Environment.TickCount64 + 30000;
        while (true)
        {
            ct.ThrowIfCancellationRequested();
            try { return new FileStream(path + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
            // Windows sharing violation, or the Unix EWOULDBLOCK values used by FileShare.None. Other I/O errors propagate.
            catch (IOException error) when ((error.HResult & 0xFFFF) is 32 or 11 or 35 && Environment.TickCount64 < deadline)
            {
                await Task.Delay(20, ct);
            }
        }
    }
}
