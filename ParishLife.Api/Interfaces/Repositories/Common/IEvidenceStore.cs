// Purpose: stores private evidence file content write-once; metadata and access rules live in the record store and services.
// Main functions: PutAsync (create-only) and OpenAsync. There is no delete: retention rules decide physical deletion.

namespace ParishLife.Api.Interfaces.Repositories.Common;

public interface IEvidenceStore
{
    Task PutAsync(string path, byte[] content, string contentType, CancellationToken ct);

    Task<byte[]?> OpenAsync(string path, CancellationToken ct);
}
