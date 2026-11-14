// Purpose: keeps each priest's image of their handwritten signature in the existing private evidence store, for printing on paper
// certificates. Only a current priest of the parish (with an authenticator session) uploads, replaces, reads or removes their own image;
// certificates attach the image current at signing, and certificate readers see only that attached image. The image is a picture,
// never an electronic signature: it proves no approval and is not part of any electronic authorization. Content is written once and
// never deleted; replaced and removed versions stay for retention and backups.
// Main functions: MineAsync, MyContentAsync, UploadAsync, RemoveAsync; CurrentAsync and ContentAsync serve certificate signing and reading.

using System.Security.Cryptography;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Files;

namespace ParishLife.Api.Services.Sacraments;

public class ClergySignatureImageService(IRecordTransactions records, IEvidenceStore store, IParishAccess access, IParishRepository parishes,
    IClergyAuthority clergy, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    internal const long MaximumBytes = 1024 * 1024;
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string PointerKey(string account) => "clergySignature:" + account;
    private static string ImageKey(string id) => "signatureImage:" + id;
    private static DomainException Missing() => new("resource_not_found", "There is no signature image here.", FailureKind.NotFound);

    // The caller's own image only: a current priest of this parish with an authenticator session and the sacraments module on.
    private async Task<Versioned<Parish>> PriestAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        await access.RequireModuleAsync(parish, "sacraments", ct);
        return await parishes.GetAsync(parish, ct) ?? throw Missing();
    }

    public async Task<ClergySignatureImageDto> MineAsync(string parish, CancellationToken ct)
    {
        await PriestAsync(parish, ct);
        return await ProjectAsync(parish, actor.AccountId, ct);
    }

    public async Task<(byte[] Content, string ContentType)> MyContentAsync(string parish, CancellationToken ct)
    {
        await PriestAsync(parish, ct);
        var image = await CurrentAsync(parish, actor.AccountId, ct) ?? throw Missing();
        return await ContentAsync(parish, image.Id, image.Sha256, ct);
    }

    public async Task<ClergySignatureImageDto> UploadAsync(string parish, Guid operationId, string declaredType, byte[] content, CancellationToken ct)
    {
        var root = await PriestAsync(parish, ct);
        if (content.Length == 0 || content.Length > MaximumBytes)
            throw new DomainException("invalid_file", "A signature image must be between 1 byte and 1 MB.");
        var type = EvidenceService.Detect(content);
        if (type is not ("image/png" or "image/jpeg") || type != declaredType)
            throw new DomainException("invalid_file", "Upload a PNG or JPEG image whose content matches its type.");
        var digest = Convert.ToHexString(SHA256.HashData(content));
        // The fingerprint binds the bytes by hash, so a retried operation can never attach different content.
        var op = actor.CreateOperation(operationId, new { type, size = content.Length, digest }, clock, "signature-image:v1:" + parish + ":" + actor.AccountId);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await ProjectAsync(parish, actor.AccountId, ct);
        var pointer = await records.ReadAsync<ClergySignature>(Scope(parish), PointerKey(actor.AccountId), ct);
        var image = new ClergySignatureImage
        {
            Id = op.Id, ParishId = parish, AccountId = actor.AccountId, StoragePath = parish + "/signature-images/" + op.Id, ContentType = type,
            Size = content.Length, Sha256 = digest, UploadedAt = op.At
        };
        var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Create(ImageKey(image.Id), "signatureImage", image) };
        if (pointer?.Value.CurrentImageId is { } previousId && await records.ReadAsync<ClergySignatureImage>(Scope(parish), ImageKey(previousId), ct) is { } previous)
        {
            previous.Value.Status = "Replaced";
            previous.Value.ReplacedById = image.Id;
            changes.Add(RecordChange.Replace(ImageKey(previousId), "signatureImage", previous.Value, previous.Version));
        }
        var next = new ClergySignature { AccountId = actor.AccountId, ParishId = parish, CurrentImageId = image.Id, UpdatedAt = op.At };
        changes.Add(pointer is null
            ? RecordChange.Create(PointerKey(actor.AccountId), "clergySignature", next)
            : RecordChange.Replace(PointerKey(actor.AccountId), "clergySignature", next, pointer.Version));
        // The complete bytes exist privately before the metadata commits; a failed commit leaves only unreferenced private content.
        await store.PutAsync(image.StoragePath, content, type, ct);
        await PriestAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, "signature_image.upload", image.Id, changes, new CommandResult { Id = image.Id, Status = image.Status }, ct);
        return await ProjectAsync(parish, actor.AccountId, ct);
    }

    public async Task<ClergySignatureImageDto> RemoveAsync(string parish, RemoveSignatureImageDto request, CancellationToken ct)
    {
        var root = await PriestAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "signature-image-remove:v1:" + parish + ":" + actor.AccountId);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await ProjectAsync(parish, actor.AccountId, ct);
        var pointer = await records.ReadAsync<ClergySignature>(Scope(parish), PointerKey(actor.AccountId), ct);
        if (pointer?.Value.CurrentImageId is not { } currentId || await records.ReadAsync<ClergySignatureImage>(Scope(parish), ImageKey(currentId), ct) is not { } current)
            throw Missing();
        current.Value.Status = "Removed";
        current.Value.RemovedAt = op.At;
        pointer.Value.CurrentImageId = null;
        pointer.Value.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "signature_image.remove", currentId,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Replace(ImageKey(currentId), "signatureImage", current.Value, current.Version),
                RecordChange.Replace(PointerKey(actor.AccountId), "clergySignature", pointer.Value, Versions.Require(request.Version))],
            new CommandResult { Id = currentId, Status = current.Value.Status }, ct);
        return await ProjectAsync(parish, actor.AccountId, ct);
    }

    // The account's current image in this parish, or null; callers have already checked their own authority.
    internal async Task<ClergySignatureImage?> CurrentAsync(string parish, string account, CancellationToken ct)
    {
        var pointer = (await records.ReadAsync<ClergySignature>(Scope(parish), PointerKey(account), ct))?.Value;
        if (pointer?.CurrentImageId is not { } id)
            return null;
        var image = (await records.ReadAsync<ClergySignatureImage>(Scope(parish), ImageKey(id), ct))?.Value;
        return image is { Status: "Active" } && image.ParishId == parish && image.AccountId == account ? image : null;
    }

    // Reads one stored image and proves it is the exact content recorded; callers have already checked their own authority.
    internal async Task<(byte[] Content, string ContentType)> ContentAsync(string parish, string imageId, string? expectedSha256, CancellationToken ct)
    {
        var image = (await records.ReadAsync<ClergySignatureImage>(Scope(parish), ImageKey(imageId), ct))?.Value;
        if (image is null || image.ParishId != parish || image.Id != imageId)
            throw Missing();
        var content = await store.OpenAsync(image.StoragePath, ct) ?? throw Missing();
        var digest = Convert.ToHexString(SHA256.HashData(content));
        if (content.Length != image.Size || !string.Equals(digest, image.Sha256, StringComparison.Ordinal)
            || expectedSha256 is not null && !string.Equals(digest, expectedSha256, StringComparison.Ordinal))
            throw new DomainException("evidence_integrity_unavailable", "The stored signature image failed its integrity check; operator recovery is required.", FailureKind.Unavailable);
        return (content, image.ContentType);
    }

    private async Task<ClergySignatureImageDto> ProjectAsync(string parish, string account, CancellationToken ct)
    {
        var pointer = await records.ReadAsync<ClergySignature>(Scope(parish), PointerKey(account), ct);
        var image = await CurrentAsync(parish, account, ct);
        return image is null
            ? new ClergySignatureImageDto { Version = pointer?.Version }
            : new ClergySignatureImageDto
            {
                HasImage = true, Id = image.Id, Version = pointer?.Version, ContentType = image.ContentType, Size = image.Size, Sha256 = image.Sha256,
                UploadedAt = image.UploadedAt
            };
    }
}
