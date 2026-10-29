using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed record EvidenceUpload(Guid CaseId, long CaseRevision, string Requirement, string FileName,
    string MediaType, byte[] Content, Guid? ReplacesId, Guid OperationId);
public sealed record CertificateAction(Guid Id, long Revision, Guid OperationId, string Action,
    string? EvidenceReference = null, string? RecipientUserId = null, string? RecipientAuthority = null,
    string? InstructingPriestUserId = null, bool PriorInstructionConfirmed = false, string? InstructionChannel = null);

public sealed class DocumentService(AppDbContext db, ITenantContext tenant, OperationalAccess access, OperationRunner operations)
{
    public async Task<OperationResult> UploadAsync(EvidenceUpload input)
    {
        var record = await db.ServiceCases.IgnoreQueryFilters().SingleOrDefaultAsync(c => c.Id == input.CaseId)
            ?? throw new ForbiddenException("Error.Unavailable");
        if (record.RequesterUserId != access.UserId) await access.OfficeAsync(record.ParishId);
        ValidateUpload(input);
        return await operations.RunAsync(record.ParishId, input.OperationId, "Evidence.Upload",
            input, async () =>
        {
            OperationRunner.Expect(record, input.CaseRevision);
            if (record.Stage is CaseStage.Registered or CaseStage.Cancelled or CaseStage.Declined)
                throw new DomainException("Error.Immutable");
            if (await db.CaseEvidence.IgnoreQueryFilters().CountAsync(e => e.CaseId == record.Id) >= 20)
                throw new DomainException("Error.FileLimit");
            if (input.ReplacesId is Guid previous && !await db.CaseEvidence.IgnoreQueryFilters().AnyAsync(e => e.Id == previous &&
                e.CaseId == record.Id && e.Status == EvidenceStatus.Rejected)) throw new DomainException("Error.State");
            var evidence = new CaseEvidence { OrgId = record.OrgId, ParishId = record.ParishId, CaseId = record.Id,
                Requirement = Guard.Required(input.Requirement, "Requirement", 200), OriginalFileName = Path.GetFileName(input.FileName),
                MediaType = input.MediaType, Content = input.Content, Status = EvidenceStatus.Uploaded,
                ReplacesId = input.ReplacesId, SuppliedByUserId = access.UserId };
            db.CaseEvidence.Add(evidence);
            record.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            return new(evidence.Id, evidence.Revision);
        });
    }

    public async Task<OperationResult> VerifyAsync(Guid id, long revision, EvidenceStatus status, string reason, Guid operationId)
    {
        var evidence = await db.CaseEvidence.SingleOrDefaultAsync(e => e.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.OfficeAsync(evidence.ParishId);
        if (status is not (EvidenceStatus.Verified or EvidenceStatus.Rejected or EvidenceStatus.PaperReceived))
            throw new DomainException("Error.State");
        return await operations.RunAsync(evidence.ParishId, operationId, "Evidence.Review", new { id, revision, status, reason }, async () =>
        {
            OperationRunner.Expect(evidence, revision);
            if (await db.ServiceCases.AnyAsync(c => c.Id == evidence.CaseId && c.Stage == CaseStage.Registered))
                throw new DomainException("Error.Immutable");
            evidence.ReviewReason = Guard.Required(reason, "Review basis", 2000);
            evidence.Status = status; evidence.ReviewedByUserId = access.UserId;
            await db.SaveChangesAsync(); return new(evidence.Id, evidence.Revision);
        });
    }

    public async Task<OperationResult> PrepareCertificateAsync(Guid caseId, string language, Guid operationId)
    {
        var source = await db.ServiceCases.SingleOrDefaultAsync(c => c.Id == caseId) ?? throw new ForbiddenException("Error.Unavailable");
        await access.OfficeAsync(source.ParishId);
        if (language is not ("en" or "fr" or "ar")) throw new DomainException("Error.Invalid");
        return await operations.RunAsync(source.ParishId, operationId, "Certificate.Prepare", new { caseId, language }, async () =>
        {
            if (source.Stage != CaseStage.Registered || source.Disputed || source.OfficialSnapshotJson is null)
                throw new DomainException("Error.OfficialSource");
            var certificate = new CertificateRecord { OrgId = source.OrgId, ParishId = source.ParishId,
                SourceCaseId = source.Id, RequesterUserId = source.RequesterUserId, Language = language,
                PriestUserId = source.ResponsiblePriestUserId ?? "", PriestName = source.ResponsiblePriestName ?? "",
                SnapshotJson = source.OfficialSnapshotJson, Stage = CertificateStage.Prepared };
            db.Certificates.Add(certificate);
            await db.SaveChangesAsync(); return new(certificate.Id, certificate.Revision);
        });
    }

    public async Task<OperationResult> ActAsync(CertificateAction input)
    {
        var certificate = await db.Certificates.SingleOrDefaultAsync(c => c.Id == input.Id)
            ?? throw new ForbiddenException("Error.Unavailable");
        await access.OfficeAsync(certificate.ParishId);
        return await operations.RunAsync(certificate.ParishId, input.OperationId, "Certificate." + input.Action, input, async () =>
        {
            OperationRunner.Expect(certificate, input.Revision);
            var source = await db.ServiceCases.SingleAsync(c => c.Id == certificate.SourceCaseId);
            if (source.Disputed && input.Action != "WithdrawRelease") throw new DomainException("Error.Disputed");
            var policy = await db.ParishPolicies.SingleOrDefaultAsync(p => p.ParishId == certificate.ParishId)
                ?? throw new DomainException("Error.PolicyRequired");
            var from = certificate.Stage;
            switch (input.Action)
            {
                case "Approve":
                    if (from != CertificateStage.Prepared) throw new DomainException("Error.State");
                    var actor = await access.RequireAsync(certificate.ParishId, SystemRole.Priest, SystemRole.Secretary);
                    var authority = access.UserId;
                    if (actor.Role == SystemRole.Secretary)
                    {
                        if (!policy.AllowProxyCertificateApproval) throw new ForbiddenException("Error.ProxyStage");
                        if (!input.PriorInstructionConfirmed || string.IsNullOrWhiteSpace(input.InstructingPriestUserId) ||
                            string.IsNullOrWhiteSpace(input.InstructionChannel) || string.IsNullOrWhiteSpace(input.EvidenceReference))
                            throw new DomainException("Error.PriorInstruction");
                        var priests = await db.Memberships.IgnoreQueryFilters().Where(m => m.OrgId == certificate.OrgId &&
                            m.ParishId == certificate.ParishId && m.UserId == input.InstructingPriestUserId && m.Role == SystemRole.Priest).ToListAsync();
                        if (!priests.Any(m => m.IsEffective(DateTimeOffset.UtcNow))) throw new ForbiddenException("Error.PriestAssignment");
                        authority = input.InstructingPriestUserId;
                        db.AccountNotifications.Add(new AccountNotification { RecipientUserId = authority, ParishId = certificate.ParishId,
                            RecordId = source.Id, MessageCode = "M03", OperationId = input.OperationId });
                    }
                    certificate.PriestUserId = authority;
                    certificate.PriestName = await db.Users.Where(u => u.Id == authority).Select(u => u.DisplayName).SingleAsync() ?? "";
                    certificate.Stage = CertificateStage.PriestApproved; break;
                case "RecordPaperSignature":
                    await access.RequireAsync(certificate.ParishId, SystemRole.Priest);
                    if (from != CertificateStage.PriestApproved || certificate.PriestUserId != access.UserId)
                        throw new DomainException("Error.State");
                    if (!policy.OfficialTemplatesApproved) throw new DomainException("Error.TemplateRequired");
                    certificate.SignedEvidenceReference = Guard.Required(input.EvidenceReference, "Signed paper reference", 500);
                    certificate.Stage = policy.BishopReviewRequired ? CertificateStage.AwaitingBishop : CertificateStage.Authorized; break;
                case "Issue":
                    if (from != CertificateStage.Authorized || certificate.SignedEvidenceReference is null || certificate.FinalContent is null ||
                        !policy.OfficialTemplatesApproved) throw new DomainException("Error.State");
                    certificate.Stage = CertificateStage.Issued; break;
                case "Release":
                    if (from != CertificateStage.Issued || certificate.FinalContent is null) throw new DomainException("Error.State");
                    var recipientInput = Guard.Required(input.RecipientUserId, "Recipient", 450);
                    certificate.RecipientAuthority = Guard.Required(input.RecipientAuthority, "Identity and authority evidence", 500);
                    var recipientName = recipientInput.ToUpperInvariant();
                    var recipient = await db.Users.SingleOrDefaultAsync(u => u.Id == recipientInput || u.NormalizedUserName == recipientName)
                        ?? throw new DomainException("Error.AccountLookup");
                    certificate.RecipientUserId = recipient.Id;
                    certificate.ReleaseExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(30);
                    certificate.Stage = CertificateStage.Released; break;
                case "Collect":
                    if (from != CertificateStage.Released || certificate.ReleaseExpiresAtUtc <= DateTimeOffset.UtcNow)
                        throw new DomainException("Error.State");
                    certificate.CollectionReference = Guard.Required(input.EvidenceReference, "Actual recipient check/receipt", 500);
                    certificate.CollectedAtUtc = DateTimeOffset.UtcNow; certificate.Stage = CertificateStage.Collected; break;
                case "WithdrawRelease":
                    if (from is not (CertificateStage.Released or CertificateStage.Collected)) throw new DomainException("Error.State");
                    Guard.Required(input.EvidenceReference, "Reason", 500);
                    certificate.RecipientUserId = null; certificate.ReleaseExpiresAtUtc = null;
                    certificate.Stage = CertificateStage.Issued; break;
                default: throw new DomainException("Error.State");
            }
            db.CaseHistories.Add(new CaseHistory { OrgId = certificate.OrgId, ParishId = certificate.ParishId,
                CaseId = source.Id, Revision = certificate.Revision + 1, Action = "Certificate." + input.Action,
                FromState = from.ToString(), ToState = certificate.Stage.ToString(), ActorUserId = access.UserId,
                AuthorityUserId = certificate.PriestUserId, InternalNote = input.EvidenceReference,
                InstructionChannel = input.InstructionChannel,
                SnapshotJson = JsonSerializer.Serialize(certificate) });
            await db.SaveChangesAsync(); return new(certificate.Id, certificate.Revision);
        });
    }

    public async Task<OperationResult> BishopReviewAsync(Guid id, long revision, bool accept, string reason, Guid operationId)
    {
        var certificate = await db.Certificates.SingleOrDefaultAsync(c => c.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.RequireAsync(certificate.ParishId, SystemRole.Archbishop);
        return await operations.RunAsync(certificate.ParishId, operationId, "Certificate.BishopReview", new { id, revision, accept, reason }, async () =>
        {
            OperationRunner.Expect(certificate, revision);
            if (certificate.Stage != CertificateStage.AwaitingBishop || certificate.SignedEvidenceReference is null || certificate.FinalContent is null)
                throw new DomainException("Error.State");
            if (!accept) Guard.Required(reason, "Return reason", 2000);
            db.CaseHistories.Add(new CaseHistory { OrgId = certificate.OrgId, ParishId = certificate.ParishId,
                CaseId = certificate.SourceCaseId, Revision = revision, Action = accept ? "BishopAccepted" : "BishopReturned",
                FromState = certificate.Stage.ToString(), ToState = accept ? "Authorized" : "Prepared",
                ActorUserId = access.UserId, InternalNote = reason, SnapshotJson = JsonSerializer.Serialize(certificate) });
            certificate.BishopUserId = accept ? access.UserId : null;
            if (!accept) { certificate.SignedEvidenceReference = null; certificate.FinalContent = null;
                certificate.FinalFileName = null; certificate.FinalMediaType = null; certificate.DocumentVersion++; }
            certificate.Stage = accept ? CertificateStage.Authorized : CertificateStage.Prepared;
            await db.SaveChangesAsync(); return new(certificate.Id, certificate.Revision);
        });
    }

    public async Task<CertificateRecord?> GetForRecipientAsync(Guid id)
    {
        // No bearer-token shortcut: this exact authenticated association must remain released and current.
        var certificate = await db.Certificates.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(c => c.Id == id &&
            c.RecipientUserId == access.UserId && (c.Stage == CertificateStage.Released || c.Stage == CertificateStage.Collected));
        if (certificate is null || certificate.ReleaseExpiresAtUtc <= DateTimeOffset.UtcNow) return null;
        if (await db.ServiceCases.IgnoreQueryFilters().AnyAsync(c => c.Id == certificate.SourceCaseId && c.Disputed)) return null;
        return certificate;
    }

    public async Task<OperationResult> AttachFinalAsync(Guid id, long revision, Guid sourceCaseId,
        string verifiedSubjectName, bool reviewedFinalConfirmed, string fileName, string mediaType, byte[] content, Guid operationId)
    {
        var certificate = await db.Certificates.SingleOrDefaultAsync(c => c.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.OfficeAsync(certificate.ParishId);
        var source = await db.ServiceCases.SingleAsync(c => c.Id == certificate.SourceCaseId);
        if (sourceCaseId != source.Id || verifiedSubjectName != source.SubjectName || !reviewedFinalConfirmed)
            throw new DomainException("Error.DocumentMismatch");
        ValidateUpload(new EvidenceUpload(sourceCaseId, revision, "Final certificate", fileName, mediaType, content, null, operationId));
        return await operations.RunAsync(certificate.ParishId, operationId, "Certificate.FinalFile",
            new { id, revision, sourceCaseId, verifiedSubjectName, fileName, mediaType, content }, async () =>
        {
            OperationRunner.Expect(certificate, revision);
            if (certificate.Stage is not (CertificateStage.AwaitingBishop or CertificateStage.Authorized))
                throw new DomainException("Error.State");
            if (certificate.FinalContent is not null) throw new DomainException("Error.Immutable");
            certificate.FinalContent = content; certificate.FinalFileName = Path.GetFileName(fileName); certificate.FinalMediaType = mediaType;
            await db.SaveChangesAsync(); return new(certificate.Id, certificate.Revision);
        });
    }

    private static void ValidateUpload(EvidenceUpload input)
    {
        if (input.Content.Length is 0 or > 10 * 1024 * 1024 || input.FileName.Length > 200)
            throw new DomainException("Error.FileLimit");
        var bytes = input.Content;
        var extension = Path.GetExtension(input.FileName).ToLowerInvariant();
        var valid = input.MediaType switch
        {
            "application/pdf" => extension == ".pdf" && bytes.AsSpan().StartsWith("%PDF-"u8),
            "image/png" => extension == ".png" && bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            "image/jpeg" => extension is ".jpg" or ".jpeg" && bytes.AsSpan().StartsWith(new byte[] { 255, 216, 255 }),
            _ => false
        };
        if (!valid) throw new DomainException("Error.FileType");
    }
}
