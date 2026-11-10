// Purpose: keeps evidence files under the local development storage folder; used only with the Local storage provider.
// Main functions: PutAsync (create-only) and OpenAsync.

using ParishLife.Api.Interfaces.Repositories.Common;

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
        await using var file = new FileStream(full, FileMode.CreateNew, FileAccess.Write);
        await file.WriteAsync(content, ct);
    }

    public async Task<byte[]?> OpenAsync(string path, CancellationToken ct)
        => File.Exists(Full(path)) ? await File.ReadAllBytesAsync(Full(path), ct) : null;
}
