using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Documents;

[Authorize]
[RequestSizeLimit(11 * 1024 * 1024)]
public sealed class PreviewModel(DocumentService documents, OperationalAccess access, ITenantContext tenant, AppDbContext db) : PageModel
{
    public CertificateRecord Certificate { get; private set; } = default!;
    public string SubjectName { get; private set; } = "";
    public string? RegisterReference { get; private set; }
    public string? CelebrantName { get; private set; }
    public string? Error { get; private set; }
    public bool Office { get; private set; }
    public bool Bishop { get; private set; }
    public string? Role => tenant.ActingRole;
    public IReadOnlyDictionary<string, string> Priests { get; private set; } = new Dictionary<string, string>();
    public async Task<IActionResult> OnGetAsync(Guid id) => await LoadAsync(id) ? Page() : NotFound();
    private async Task<bool> LoadAsync(Guid id)
    {
        var row = await db.Certificates.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(c => c.Id == id);
        if (row is null) return false;
        try { await access.OfficeAsync(row.ParishId); Office = true; }
        catch (ForbiddenException)
        {
            if (tenant.ActingRole == "Archbishop")
            {
                try { await access.RequireAsync(row.ParishId, ParishLive.Domain.Enums.SystemRole.Archbishop); Bishop = true; }
                catch (ForbiddenException) { return false; }
            }
            else if (await documents.GetForRecipientAsync(id) is null) return false;
        }
        Certificate = row;
        if (Office)
        {
            var assignments = (await db.Memberships.Where(m => m.ParishId == row.ParishId && m.Role == ParishLive.Domain.Enums.SystemRole.Priest).ToListAsync())
                .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).Select(m => m.UserId).ToArray();
            Priests = await db.Users.Where(u => assignments.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? "");
        }
        using var snapshot = JsonDocument.Parse(row.SnapshotJson);
        SubjectName = snapshot.RootElement.GetProperty("SubjectName").GetString() ?? "";
        RegisterReference = snapshot.RootElement.GetProperty("RegisterReference").GetString();
        CelebrantName = snapshot.RootElement.GetProperty("CelebrantName").GetString();
        return true;
    }
    public async Task<IActionResult> OnGetDownloadAsync(Guid id)
    {
        if (!await LoadAsync(id) || Certificate.FinalContent is null) return NotFound();
        return File(Certificate.FinalContent, Certificate.FinalMediaType ?? "application/octet-stream", Certificate.FinalFileName ?? "document.pdf");
    }
    public async Task<IActionResult> OnPostAsync(Guid id, long revision, Guid operationId, string action,
        string? evidenceReference, string? recipientUserId, string? recipientAuthority, string? instructingPriestUserId,
        bool priorInstructionConfirmed, string? instructionChannel)
    {
        try
        {
            await documents.ActAsync(new CertificateAction(id, revision, operationId, action, evidenceReference, recipientUserId, recipientAuthority,
                instructingPriestUserId, priorInstructionConfirmed, instructionChannel));
            return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
    public async Task<IActionResult> OnPostFinalAsync(Guid id, long revision, Guid operationId, Guid sourceCaseId,
        string verifiedSubjectName, bool reviewedFinalConfirmed, IFormFile? file)
    {
        try
        {
            if (file is null || file.Length > 10 * 1024 * 1024) throw new DomainException("Error.FileLimit");
            using var buffer = new MemoryStream(); await file.CopyToAsync(buffer);
            await documents.AttachFinalAsync(id, revision, sourceCaseId, verifiedSubjectName, reviewedFinalConfirmed,
                file.FileName, file.ContentType, buffer.ToArray(), operationId);
            return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
    public async Task<IActionResult> OnPostBishopAsync(Guid id, long revision, Guid operationId, bool accept, string reason)
    {
        try { await documents.BishopReviewAsync(id, revision, accept, reason, operationId); return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId }); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
}
