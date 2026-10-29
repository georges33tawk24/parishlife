using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed record GuestRequest(Guid ParishId, ServiceKind Kind, string SubjectName, string Contact,
    string Details, string Language, string SubmissionSecret, Guid OperationId);
public sealed record GuestStatus(Guid Id, string Reference, string Stage, IReadOnlyList<string> Replies);

public sealed class GuestIntakeService(DbContextOptions<AppDbContext> options)
{
    public async Task ConfigureAsync(AppDbContext db, ITenantContext tenant, Guid parishId, bool enabled,
        ServiceKind[] kinds, string approvalReference, bool actualApprovalConfirmed, Guid operationId)
    {
        await new OperationalAccess(db, tenant).RequireAsync(parishId, ParishLive.Domain.Enums.SystemRole.Priest);
        if (!actualApprovalConfirmed || kinds.Length == 0 || kinds.Any(k => !Enum.IsDefined(k))) throw new DomainException("Error.PolicyRequired");
        Guard.Required(approvalReference, "Actual public intake approval", 500);
        await new OperationRunner(db, tenant).RunAsync(parishId, operationId, "Intake.Configure", new { parishId, enabled, kinds, approvalReference }, async () =>
        {
            var parish = await db.Parishes.SingleAsync(p => p.Id == parishId);
            parish.GuestIntakeEnabled = enabled; parish.GuestRequestKindsJson = JsonSerializer.Serialize(kinds.Select(k => k.ToString()).Distinct());
            db.CaseHistories.Add(new CaseHistory { OrgId = parish.OrgId, ParishId = parishId, CaseId = parishId,
                Action = enabled ? "GuestIntakeEnabled" : "GuestIntakeDisabled", ActorUserId = tenant.UserId!, InternalNote = approvalReference });
            await db.SaveChangesAsync(); return new(parishId, 1);
        });
    }
    public static string NewSecret() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private static string Hash(string secret) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
    public async Task<GuestStatus> SubmitAsync(GuestRequest input)
    {
        if (input.SubmissionSecret is null || input.SubmissionSecret.Length != 64 || !input.SubmissionSecret.All(Uri.IsHexDigit) || input.OperationId == Guid.Empty)
            throw new DomainException("Error.Invalid");
        await using var lookup = new AppDbContext(options, StaticTenantContext.None);
        var parish = await lookup.Parishes.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(p => p.Id == input.ParishId &&
            p.PubliclyListed && p.Lifecycle == "Active" && p.GuestIntakeEnabled) ?? throw new DomainException("Error.Unavailable");
        var kinds = JsonSerializer.Deserialize<string[]>(parish.GuestRequestKindsJson) ?? [];
        if (!Enum.IsDefined(input.Kind) || !kinds.Contains(input.Kind.ToString()) || input.Language is not ("en" or "fr" or "ar"))
            throw new DomainException("Error.Unavailable");
        var subject = Guard.Required(input.SubjectName, "Supplied subject name", 200);
        var contact = Guard.Required(input.Contact, "Actual applicant contact", 500);
        var details = Guard.Optional(input.Details, "Details", 9000);
        var tokenHash = Hash(input.SubmissionSecret);
        var actor = "guest:" + tokenHash;
        var tenant = new StaticTenantContext(parish.OrgId, [parish.Id], false, actor);
        await using var db = new AppDbContext(options, tenant);
        var result = await new OperationRunner(db, tenant).RunAsync(parish.Id, input.OperationId, "Guest.Submit",
            new { input.ParishId, input.Kind, subject, contact, details, input.Language }, async () =>
        {
            if (await db.GuestAccess.AnyAsync(g => g.TokenHash == tokenHash)) throw new DomainException("Error.OperationMismatch");
            var record = new ServiceCase { OrgId = parish.OrgId, ParishId = parish.Id, Kind = input.Kind,
                SubjectName = subject, RequesterUserId = actor, Origin = "Guest", Language = input.Language,
                Stage = CaseStage.Received, Reference = "PL-" + Guid.NewGuid().ToString("N").ToUpperInvariant(),
                SuppliedFactsJson = JsonSerializer.Serialize(new { contact, details }) };
            db.ServiceCases.Add(record);
            db.GuestAccess.Add(new GuestAccess { OrgId = parish.OrgId, ParishId = parish.Id, CaseId = record.Id,
                TokenHash = tokenHash, ExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(30) });
            db.CaseHistories.Add(new CaseHistory { OrgId = parish.OrgId, ParishId = parish.Id, CaseId = record.Id,
                Action = "Create", ActorUserId = "Guest submission", ToState = "Received", Revision = 1 });
            await db.SaveChangesAsync(); return new OperationResult(record.Id, record.Revision);
        });
        return await StatusAsync(input.SubmissionSecret) ?? throw new DomainException("Error.Unavailable");
    }

    public async Task<GuestStatus?> StatusAsync(string secret)
    {
        if (secret is null || secret.Length != 64 || !secret.All(Uri.IsHexDigit)) return null;
        var hash = Hash(secret);
        await using var db = new AppDbContext(options, StaticTenantContext.None);
        var grant = await db.GuestAccess.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(g => g.TokenHash == hash && !g.Revoked);
        if (grant is null || grant.ExpiresAtUtc <= DateTimeOffset.UtcNow) return null;
        var record = await db.ServiceCases.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(c => c.Id == grant.CaseId);
        if (record is null) return null;
        var replies = await db.CaseHistories.IgnoreQueryFilters().AsNoTracking().Where(h => h.CaseId == record.Id && h.ApplicantMessage != null)
            .Select(h => h.ApplicantMessage!).ToListAsync();
        // No files, internal notes, contact, linked person, clergy instruction or other-party data.
        return new(record.Id, record.Reference, record.Stage.ToString(), replies);
    }

    public async Task AssociateAsync(AppDbContext db, ITenantContext tenant, Guid caseId, string targetUsername,
        string evidenceReference, Guid operationId)
    {
        var record = await db.ServiceCases.SingleOrDefaultAsync(c => c.Id == caseId) ?? throw new ForbiddenException("Error.Unavailable");
        await new OperationalAccess(db, tenant).OfficeAsync(record.ParishId);
        var normalized = targetUsername.ToUpperInvariant();
        var account = await db.Users.SingleOrDefaultAsync(u => u.NormalizedUserName == normalized) ?? throw new DomainException("Error.AccountLookup");
        await new OperationRunner(db, tenant).RunAsync(record.ParishId, operationId, "Guest.Associate",
            new { caseId, targetUsername, evidenceReference }, async () =>
        {
            var grant = await db.GuestAccess.SingleOrDefaultAsync(g => g.CaseId == caseId) ?? throw new DomainException("Error.Unavailable");
            if (grant.AssociatedUserId is not null) throw new DomainException("Error.IdentityReview");
            grant.AssociationEvidenceReference = Guard.Required(evidenceReference, "Actual requester identity review", 500);
            grant.AssociatedByUserId = tenant.UserId; grant.AssociatedUserId = account.Id; grant.Revoked = true;
            record.RequesterUserId = account.Id; record.UpdatedAtUtc = DateTimeOffset.UtcNow;
            db.CaseHistories.Add(new CaseHistory { OrgId = record.OrgId, ParishId = record.ParishId, CaseId = caseId,
                Action = "GuestAssociated", ActorUserId = tenant.UserId!, InternalNote = evidenceReference,
                ToState = record.Stage.ToString(), Revision = record.Revision + 1 });
            await db.SaveChangesAsync(); return new OperationResult(record.Id, record.Revision);
        });
    }
}
