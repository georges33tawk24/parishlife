// Purpose: private evidence files on request cases. The applicant and request office staff upload PDF/JPEG/PNG files (checked by content,
// up to 10 MB, 20 active files per case) and replace them with the earlier version kept; the applicant sees only their own uploads; office
// staff remove files with a reason. Content is written once and never deleted here; closed cases are read-only.
// Main functions: UploadAsync, ListAsync, DownloadAsync and RemoveAsync; CaseAsync preserves original parish/case versions,
// replay validation binds legacy receipts to immutable content, and download checks the committed size/hash.

using System.Security.Cryptography;
using ParishLife.Api.DTOs.Files;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Requests;

namespace ParishLife.Api.Services.Files;

public class EvidenceService(IRecordTransactions records, IEvidenceStore store, IParishAccess access, MinistryAccess own, ICurrentActor actor,
    MfaAccountAccess proof, TimeProvider clock)
{
    internal const long MaximumBytes = 10 * 1024 * 1024;
    private const int MaximumActive = 20;
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException Missing() => new("resource_not_found", "The requested file is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_file_state", message, FailureKind.Conflict);

    // Office (requests.manage with MFA) or the case's own signed-in applicant; anyone else sees nothing.
    private async Task<(Versioned<ParishRequest> Case, Versioned<Parish> Root, bool Office)> CaseAsync(string parish, string request, CancellationToken ct)
    {
        var item = await records.ReadAsync<ParishRequest>(Scope(parish), "request:" + request, ct);
        if (item is null || item.Value.ParishId != parish || item.Value.Id != request)
            throw Missing();
        Versioned<Parish> root;
        var office = item.Value.ApplicantAccountId != actor.AccountId;
        if (!office)
        {
            await own.PersonalAsync(ct);
            root = await own.RootAsync(parish, ct);
        }
        else
        {
            await proof.RequireMfaAsync(ct);
            root = await access.RequireAsync(parish, Permissions.RequestsManage, ct);
            if (root.Value.Status != ParishStatus.Verified) throw Missing();
        }
        await access.RequireModuleAsync(parish, "requests", ct);
        return (item, root, office);
    }

    public async Task<EvidenceFileDto> UploadAsync(string parish, string request, Guid operationId, string fileName, string declaredType, byte[] content,
        string? replaces, string? reason, CancellationToken ct)
    {
        var (item, root, office) = await CaseAsync(parish, request, ct);
        // Keep the v1 fingerprint unchanged: existing successful receipts must remain retryable.
        // Their file metadata and create-or-match storage bind the bytes, including interrupted staged attempts.
        var op = actor.CreateOperation(operationId, new { request, fileName, declaredType, size = content.Length, replaces, reason }, clock, "evidence:v1:" + request);
        if (content.Length == 0 || content.Length > MaximumBytes)
            throw new DomainException("invalid_file", "Files must be between 1 byte and 10 MB.");
        var type = Detect(content);
        if (type is null || type != declaredType)
            throw new DomainException("invalid_file", "Upload a PDF, JPEG or PNG file whose content matches its type.");
        var digest = Convert.ToHexString(SHA256.HashData(content));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
        {
            var saved = await ReadAsync(parish, prior.Id, ct);
            RequireAudience(saved.Value, request, office);
            if (!Matches(saved.Value, content.Length, digest, type))
                throw new DomainException("operation_reused", "This upload operation already belongs to different file content.", FailureKind.Conflict);
            return Project(saved);
        }
        if (RequestService.Terminal.Contains(item.Value.Status))
            throw State("This case is closed; its files are read-only.");
        var name = Guard.Text(Path.GetFileName(fileName), "File name", 200);
        var active = (await FilesAsync(parish, request, ct)).Where(f => f.Value.Status == "Active").ToList();
        var changes = new List<RecordChange>();
        Versioned<EvidenceFile>? old = null;
        if (replaces is not null)
        {
            old = active.FirstOrDefault(f => f.Value.Id == replaces) ?? throw Missing();
            if (!office && old.Value.UploadedBy != actor.AccountId)
                throw Missing();
        }
        else if (active.Count >= MaximumActive)
            throw State("A case holds up to 20 active files; replace or remove one first.");
        var file = new EvidenceFile
        {
            Id = op.Id, ParishId = parish, RequestId = request, FileName = name, ContentType = type, Size = content.Length,
            Sha256 = digest, StoragePath = parish + "/" + op.Id, UploadedBy = actor.AccountId,
            UploaderRole = office ? "Office" : "Applicant", UploadedAt = op.At, ReplacesId = old?.Value.Id,
            Reason = old is null ? null : Guard.Text(reason, "Reason for replacing", 500)
        };
        if (old is not null)
        {
            old.Value.Status = "Replaced";
            old.Value.ReplacedById = file.Id;
            changes.Add(RecordChange.Replace("evidenceFile:" + old.Value.Id, "evidenceFile", old.Value, old.Version));
        }
        changes.Add(RecordChange.Create("evidenceFile:" + file.Id, "evidenceFile", file));
        changes.Add(RecordChange.Replace("request:" + request, "parishRequest", item.Value, item.Version));
        changes.Add(MinistryAccess.Fence(root));
        // A complete byte-identical object must exist before metadata commits. Failures can leave private staged content;
        // retries may reuse it only after the store proves it matches. No retained evidence is overwritten or deleted.
        await store.PutAsync(file.StoragePath, content, type, ct);
        // Recheck current authority after I/O, retaining the original conditional versions rather than refreshing stale values.
        await CaseAsync(parish, request, ct);
        await records.CommitAsync(Scope(parish), op, "evidence.upload", file.Id, changes, new CommandResult { Id = file.Id, Status = file.Status }, ct);
        return Project(await ReadAsync(parish, file.Id, ct));
    }

    public async Task<IReadOnlyList<EvidenceFileDto>> ListAsync(string parish, string request, CancellationToken ct)
    {
        var (_, _, office) = await CaseAsync(parish, request, ct);
        return (await FilesAsync(parish, request, ct)).Where(f => office || f.Value.UploadedBy == actor.AccountId)
            .OrderBy(f => f.Value.UploadedAt).Select(Project).ToArray();
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> DownloadAsync(string parish, string request, string id, CancellationToken ct)
    {
        var (_, _, office) = await CaseAsync(parish, request, ct);
        var file = (await ReadAsync(parish, id, ct)).Value;
        RequireAudience(file, request, office);
        if (file.Status == "Removed" && !office)
            throw Missing();
        var content = await store.OpenAsync(file.StoragePath, ct) ?? throw Missing();
        if (!Matches(file, content.Length, Convert.ToHexString(SHA256.HashData(content)), file.ContentType))
            throw new DomainException("evidence_integrity_unavailable", "The stored file failed its integrity check; operator recovery is required.", FailureKind.Unavailable);
        return (content, file.ContentType, file.FileName);
    }

    public async Task<EvidenceFileDto> RemoveAsync(string parish, string request, string id, RemoveEvidenceDto body, CancellationToken ct)
    {
        var (item, root, office) = await CaseAsync(parish, request, ct);
        if (!office)
            throw Missing();
        var file = (await ReadAsync(parish, id, ct)).Value;
        RequireAudience(file, request, office);
        var op = actor.CreateOperation(body.OperationId, body, clock, "evidence-remove:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(await ReadAsync(parish, id, ct));
        if (RequestService.Terminal.Contains(item.Value.Status))
            throw State("This case is closed; its files are read-only.");
        if (file.Status != "Active")
            throw State("Only an active file of this case can be removed.");
        file.Status = "Removed";
        file.Reason = Guard.Text(body.Reason, "Reason", 500);
        await CaseAsync(parish, request, ct);
        await records.CommitAsync(Scope(parish), op, "evidence.remove", id,
            [MinistryAccess.Fence(root), RecordChange.Replace("request:" + request, "parishRequest", item.Value, item.Version),
                RecordChange.Replace("evidenceFile:" + id, "evidenceFile", file, Versions.Require(body.Version))],
            new CommandResult { Id = id, Status = file.Status }, ct);
        return Project(await ReadAsync(parish, id, ct));
    }

    // Only the actual content decides the type; names and declared types are not trusted.
    internal static string? Detect(byte[] content) => content switch
    {
        [0x25, 0x50, 0x44, 0x46, 0x2D, ..] => "application/pdf",
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] => "image/png",
        _ => null
    };

    private async Task<IReadOnlyList<Versioned<EvidenceFile>>> FilesAsync(string parish, string request, CancellationToken ct)
        => (await records.CollectAsync<EvidenceFile>(Scope(parish), "evidenceFile", ct, 500, new RecordCondition { Path = "requestId", Comparison = "eq", Value = request }));

    private async Task<Versioned<EvidenceFile>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<EvidenceFile>(Scope(parish), "evidenceFile:" + id, ct) is { } row && row.Value.ParishId == parish && row.Value.Id == id ? row : throw Missing();

    private void RequireAudience(EvidenceFile file, string request, bool office)
    {
        if (file.RequestId != request || !office && file.UploadedBy != actor.AccountId) throw Missing();
    }

    private static bool Matches(EvidenceFile file, long size, string digest, string type)
        => file.Size == size && string.Equals(file.Sha256, digest, StringComparison.Ordinal) && file.ContentType == type;

    private static EvidenceFileDto Project(Versioned<EvidenceFile> row) => new()
    {
        Id = row.Value.Id, Version = row.Version, FileName = row.Value.FileName, ContentType = row.Value.ContentType, Size = row.Value.Size, Sha256 = row.Value.Sha256,
        UploaderRole = row.Value.UploaderRole, UploadedAt = row.Value.UploadedAt, Status = row.Value.Status, ReplacesId = row.Value.ReplacesId,
        ReplacedById = row.Value.ReplacedById, Reason = row.Value.Reason
    };
}
