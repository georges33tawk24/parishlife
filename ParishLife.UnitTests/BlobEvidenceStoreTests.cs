// Purpose: verifies conditional immutable Blob evidence writes using SDK test doubles, without credentials, network calls or Azure changes.
// Main tests: conditional creation, matching collision recovery, byte/type conflicts and propagation of unrelated upload/read failures.

using System.Diagnostics.CodeAnalysis;
using Azure;
using Azure.Core;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using ParishLife.Api.Data.Blob;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using Xunit;

namespace ParishLife.Tests;

public class BlobEvidenceStoreTests
{
    [Fact]
    public async Task New_content_is_published_with_a_create_only_condition_and_its_content_type()
    {
        var content = "isolated evidence"u8.ToArray();
        var blob = new EvidenceBlob();
        var store = new BlobEvidenceStore(new EvidenceContainer(blob));

        await store.PutAsync("parish/operation", content, "application/pdf", default);

        Assert.Equal(ETag.All, blob.LastUpload?.Conditions?.IfNoneMatch);
        Assert.Equal("application/pdf", blob.LastUpload?.HttpHeaders?.ContentType);
        Assert.Equal(content, blob.StoredContent);
        Assert.Equal(0, blob.Downloads);
    }

    [Theory]
    [InlineData(409, "BlobAlreadyExists")]
    [InlineData(412, "ConditionNotMet")]
    public async Task An_expected_creation_race_succeeds_only_after_verifying_the_existing_complete_content(int status, string code)
    {
        var content = "isolated evidence"u8.ToArray();
        var blob = new EvidenceBlob(content, "application/pdf") { CollisionStatus = status, CollisionCode = code };
        var store = new BlobEvidenceStore(new EvidenceContainer(blob));

        await store.PutAsync("parish/operation", content, "application/pdf", default);

        Assert.Equal(content, blob.StoredContent);
        Assert.Equal(1, blob.Downloads);
    }

    [Theory]
    [InlineData(409, "BlobAlreadyExists", false)]
    [InlineData(409, "BlobAlreadyExists", true)]
    [InlineData(412, "ConditionNotMet", false)]
    [InlineData(412, "ConditionNotMet", true)]
    public async Task Collision_with_different_bytes_or_content_type_is_a_conflict_without_overwriting(int status, string code, bool differentType)
    {
        var original = "first evidence"u8.ToArray();
        var requested = differentType ? original : "other evidence"u8.ToArray();
        Assert.Equal(original.Length, requested.Length);
        var blob = new EvidenceBlob(original, "application/pdf") { CollisionStatus = status, CollisionCode = code };
        var store = new BlobEvidenceStore(new EvidenceContainer(blob));

        var error = await Assert.ThrowsAsync<DomainException>(() => store.PutAsync("parish/operation", requested, differentType ? "image/png" : "application/pdf", default));

        Assert.Equal(("evidence_content_conflict", FailureKind.Conflict), (error.Code, error.Kind));
        Assert.Equal(original, blob.StoredContent);
        Assert.Equal("application/pdf", blob.StoredType);
    }

    [Theory]
    [InlineData(409, "LeaseAlreadyPresent")]
    [InlineData(412, "LeaseIdMissing")]
    [InlineData(403, "AuthorizationPermissionMismatch")]
    [InlineData(500, "InternalError")]
    public async Task Unrelated_creation_failures_propagate_without_reading_or_claiming_an_existing_blob(int status, string code)
    {
        var failure = new RequestFailedException(status, "Isolated failure", code, null);
        var blob = new EvidenceBlob("existing"u8.ToArray(), "application/pdf") { UploadFailure = failure };
        var store = new BlobEvidenceStore(new EvidenceContainer(blob));

        Assert.Same(failure, await Assert.ThrowsAsync<RequestFailedException>(() => store.PutAsync("parish/operation", "existing"u8.ToArray(), "application/pdf", default)));
        Assert.Equal(0, blob.Downloads);
    }

    [Fact]
    public async Task Failed_collision_verification_is_not_reported_as_success()
    {
        var failure = new RequestFailedException(403, "Isolated read failure", "AuthorizationPermissionMismatch", null);
        var blob = new EvidenceBlob("existing"u8.ToArray(), "application/pdf") { DownloadFailure = failure };
        var store = new BlobEvidenceStore(new EvidenceContainer(blob));

        Assert.Same(failure, await Assert.ThrowsAsync<RequestFailedException>(() => store.PutAsync("parish/operation", "existing"u8.ToArray(), "application/pdf", default)));
    }

    [Fact]
    public async Task Read_returns_missing_only_for_a_missing_blob_and_propagates_missing_container_failures()
    {
        var blob = new EvidenceBlob();
        var store = new BlobEvidenceStore(new EvidenceContainer(blob));
        Assert.Null(await store.OpenAsync("parish/operation", default));
        var failure = new RequestFailedException(404, "Isolated missing container", "ContainerNotFound", null);
        blob.DownloadFailure = failure;
        Assert.Same(failure, await Assert.ThrowsAsync<RequestFailedException>(() => store.OpenAsync("parish/operation", default)));
    }

    private sealed class EvidenceContainer(EvidenceBlob blob) : BlobContainerClient
    {
        public override BlobClient GetBlobClient(string blobName) => blob;
    }

    private sealed class EvidenceBlob(byte[]? content = null, string? contentType = null) : BlobClient
    {
        internal byte[]? StoredContent { get; private set; } = content?.ToArray();
        internal string? StoredType { get; private set; } = contentType;
        internal BlobUploadOptions? LastUpload { get; private set; }
        internal int Downloads { get; private set; }
        internal int CollisionStatus { get; init; } = 409;
        internal string CollisionCode { get; init; } = "BlobAlreadyExists";
        internal RequestFailedException? UploadFailure { get; init; }
        internal RequestFailedException? DownloadFailure { get; set; }

        public override Task<Response<BlobContentInfo>> UploadAsync(BinaryData content, BlobUploadOptions options, CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            LastUpload = options;
            if (UploadFailure is { } failure)
                throw failure;
            if (StoredContent is not null)
                throw new RequestFailedException(CollisionStatus, "Isolated conditional collision", CollisionCode, null);
            StoredContent = content.ToArray();
            StoredType = options.HttpHeaders.ContentType;
            return Task.FromResult(Response.FromValue<BlobContentInfo>(null!, new EvidenceResponse(201)));
        }

        public override Task<Response<BlobDownloadResult>> DownloadContentAsync(CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Downloads++;
            if (DownloadFailure is { } failure)
                throw failure;
            if (StoredContent is null)
                throw new RequestFailedException(404, "Isolated missing blob", "BlobNotFound", null);
            var details = BlobsModelFactory.BlobDownloadDetails(contentType: StoredType, contentLength: StoredContent.LongLength);
            var result = BlobsModelFactory.BlobDownloadResult(new BinaryData(StoredContent), details);
            return Task.FromResult(Response.FromValue(result, new EvidenceResponse(200)));
        }
    }

    private sealed class EvidenceResponse(int status) : Response
    {
        public override int Status => status;
        public override string ReasonPhrase => "Isolated test response";
        public override Stream? ContentStream { get; set; }
        public override string ClientRequestId { get; set; } = string.Empty;
        public override void Dispose() { }
        protected override bool ContainsHeader(string name) => false;
        protected override IEnumerable<HttpHeader> EnumerateHeaders() => [];
        protected override bool TryGetHeader(string name, [NotNullWhen(true)] out string? value) { value = null; return false; }
        protected override bool TryGetHeaderValues(string name, [NotNullWhen(true)] out IEnumerable<string>? values) { values = null; return false; }
    }
}
