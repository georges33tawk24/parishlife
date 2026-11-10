// Purpose: stores private evidence file content write-once; metadata and access rules live in the record store and services.
// Main functions: PutAsync atomically creates complete content or verifies an identical existing object; OpenAsync reads it.
// There is no delete: retention rules decide physical deletion.

namespace ParishLife.Api.Interfaces.Repositories.Common;

public interface IEvidenceStore
{
    // Completion guarantees complete immutable bytes match content. An existing different object is an evidence_content_conflict;
    // providers with stored content headers also check contentType. Other storage failures propagate, and content is never overwritten.
    Task PutAsync(string path, byte[] content, string contentType, CancellationToken ct);

    Task<byte[]?> OpenAsync(string path, CancellationToken ct);
}
