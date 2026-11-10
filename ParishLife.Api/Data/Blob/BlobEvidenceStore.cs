// Purpose: keeps evidence files in the existing private Blob container (managed identity); never creates containers or overwrites blobs.
// Main functions: PutAsync conditionally creates content or verifies an identical existing blob; OpenAsync reads content.

using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Data.Blob;

internal sealed class BlobEvidenceStore(BlobContainerClient container) : IEvidenceStore
{
    public async Task PutAsync(string path, byte[] content, string contentType, CancellationToken ct)
    {
        var blob = container.GetBlobClient(path);
        try
        {
            await blob.UploadAsync(new BinaryData(content), new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = contentType },
                Conditions = new BlobRequestConditions { IfNoneMatch = ETag.All }
            }, ct);
        }
        catch (RequestFailedException error) when (
            error.Status == 409 && error.ErrorCode == BlobErrorCode.BlobAlreadyExists.ToString()
            || error.Status == 412 && error.ErrorCode == BlobErrorCode.ConditionNotMet.ToString())
        {
            var existing = (await blob.DownloadContentAsync(ct)).Value;
            if (existing.Details.ContentType != contentType || !existing.Content.ToMemory().Span.SequenceEqual(content))
                throw new DomainException("evidence_content_conflict", "This evidence location already contains different content or a different content type.", FailureKind.Conflict);
        }
    }

    public async Task<byte[]?> OpenAsync(string path, CancellationToken ct)
    {
        try { return (await container.GetBlobClient(path).DownloadContentAsync(ct)).Value.Content.ToArray(); }
        catch (RequestFailedException error) when (error.Status == 404 && error.ErrorCode == BlobErrorCode.BlobNotFound.ToString()) { return null; }
    }
}
