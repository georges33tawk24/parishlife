using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Application.Operations;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Requests;

[Authorize]
[RequestSizeLimit(11 * 1024 * 1024)]
public sealed class DetailModel(ParishCaseService cases, DocumentService documents, GuestIntakeService guests, AppDbContext db, ITenantContext tenant) : PageModel
{
    public CaseView Record { get; private set; } = default!;
    public IReadOnlyList<CaseEvidence> Evidence { get; private set; } = [];
    public IReadOnlyList<CertificateRecord> Certificates { get; private set; } = [];
    public IReadOnlyList<(string Id, string Name)> Priests { get; private set; } = [];
    public bool IsOffice => tenant.ActingRole is "Priest" or "Secretary" or "ParishAdmin" or "ArchdioceseAdmin";
    public string? Error { get; private set; }
    [BindProperty] public long Revision { get; set; }
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    [BindProperty] public string? ApplicantMessage { get; set; }
    [BindProperty] public string? InternalNote { get; set; }
    [BindProperty] public string? PriestUserId { get; set; }
    [BindProperty] public bool PriorInstructionConfirmed { get; set; }
    [BindProperty] public string? InstructionChannel { get; set; }
    [BindProperty] public string? InstructionAtUtc { get; set; }
    [BindProperty] public string? ActualAtUtc { get; set; }
    [BindProperty] public string? CelebrantName { get; set; }
    [BindProperty] public string? CorrectedSubjectName { get; set; }
    public bool GuestOrigin { get; private set; }

    public async Task<IActionResult> OnGetAsync(Guid id) => await LoadAsync(id) ? Page() : NotFound();
    private async Task<bool> LoadAsync(Guid id)
    {
        var record = await cases.GetAsync(id); if (record is null) return false;
        Record = record; Revision = record.Revision;
        GuestOrigin = IsOffice && await db.GuestAccess.AnyAsync(g => g.CaseId == id && !g.Revoked);
        Evidence = await db.CaseEvidence.IgnoreQueryFilters().AsNoTracking().Where(e => e.CaseId == id && (IsOffice || e.SuppliedByUserId == tenant.UserId))
            .Select(e => new CaseEvidence { Id = e.Id, Requirement = e.Requirement, OriginalFileName = e.OriginalFileName,
                Status = e.Status, Revision = e.Revision }).ToListAsync();
        Certificates = await db.Certificates.AsNoTracking().Where(c => c.SourceCaseId == id).ToListAsync();
        if (IsOffice)
        {
            var assignments = (await db.Memberships.Where(m => m.ParishId == record.ParishId && m.Role == ParishLive.Domain.Enums.SystemRole.Priest).ToListAsync())
                .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).Select(m => m.UserId).ToList();
            var people = await db.Users.Where(u => assignments.Contains(u.Id)).Select(u => new { u.Id, u.DisplayName }).ToListAsync();
            Priests = people.Select(u => (u.Id, u.DisplayName ?? "")).ToList();
        }
        return true;
    }
    public async Task<IActionResult> OnPostAsync(Guid id, string action)
    {
        try
        {
            await cases.DecideAsync(new CaseDecision(id, Revision, OperationId, action, ApplicantMessage, InternalNote,
                PriestUserId, PriorInstructionConfirmed, string.IsNullOrEmpty(InstructionAtUtc) ? null : Forms.UtcInput.Parse(InstructionAtUtc), InstructionChannel,
                string.IsNullOrEmpty(ActualAtUtc) ? null : Forms.UtcInput.Parse(ActualAtUtc), CelebrantName, CorrectedSubjectName));
            return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
    public async Task<IActionResult> OnGetEvidenceAsync(Guid id, Guid evidenceId)
    {
        if (!await LoadAsync(id)) return NotFound();
        var file = await db.CaseEvidence.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(e => e.Id == evidenceId &&
            e.CaseId == id && (IsOffice || e.SuppliedByUserId == tenant.UserId));
        if (file?.Content is null) return NotFound();
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(file.Content, file.MediaType, file.OriginalFileName);
    }
    public async Task<IActionResult> OnPostUploadAsync(Guid id, IFormFile? file, string requirement, Guid? replacesId)
    {
        try
        {
            if (file is null || file.Length > 10 * 1024 * 1024) throw new DomainException("Error.FileLimit");
            using var buffer = new MemoryStream(); await file.CopyToAsync(buffer);
            await documents.UploadAsync(new EvidenceUpload(id, Revision, requirement, file.FileName, file.ContentType, buffer.ToArray(), replacesId, OperationId));
            return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
    public async Task<IActionResult> OnPostVerifyAsync(Guid id, Guid evidenceId, long evidenceRevision, EvidenceStatus status, string basis)
    {
        try { await documents.VerifyAsync(evidenceId, evidenceRevision, status, basis, OperationId); return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId }); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
    public async Task<IActionResult> OnPostCertificateAsync(Guid id)
    {
        try { await documents.PrepareCertificateAsync(id, System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName, OperationId); return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId }); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
    public async Task<IActionResult> OnPostAssociateAsync(Guid id, string username, string evidenceReference)
    {
        try { await guests.AssociateAsync(db, tenant, id, username, evidenceReference, OperationId); return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId }); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
}
