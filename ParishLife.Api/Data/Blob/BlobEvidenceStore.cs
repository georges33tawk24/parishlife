// Purpose: keeps evidence files in the existing private Blob container (managed identity); never creates containers or overwrites blobs.
// Main functions: PutAsync (create-only) and OpenAsync.

using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using ParishLife.Api.Interfaces.Repositories.Common;

namespace ParishLife.Api.Data.Blob;

internal sealed class BlobEvidenceStore(BlobContainerClient container) : IEvidenceStore
{
    public async Task PutAsync(string path, byte[] content, string contentType, CancellationToken ct)
        => await container.GetBlobClient(path).UploadAsync(new BinaryData(content), new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType },
            Conditions = new BlobRequestConditions { IfNoneMatch = ETag.All }
        }, ct);

    public async Task<byte[]?> OpenAsync(string path, CancellationToken ct)
    {
        try { return (await container.GetBlobClient(path).DownloadContentAsync(ct)).Value.Content.ToArray(); }
        catch (RequestFailedException error) when (error.Status == 404) { return null; }
    }
}
