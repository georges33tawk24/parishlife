using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Application.Operations;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Operations;
using ParishLive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ParishLive.Web.Pages.Requests;

[Authorize]
public sealed class EditModel(ParishCaseService cases, ITenantContext tenant, AppDbContext db) : PageModel
{
    [BindProperty(SupportsGet = true)] public Guid? Id { get; set; }
    [BindProperty] public long Revision { get; set; }
    [BindProperty(SupportsGet = true)] public Guid ParishId { get; set; }
    public IReadOnlyList<(Guid Id, string Name)> Parishes { get; private set; } = [];
    [BindProperty] public string SubjectName { get; set; } = "";
    [BindProperty] public ServiceKind Kind { get; set; }
    [BindProperty] public string Details { get; set; } = "";
    [BindProperty] public string Language { get; set; } = "en";
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    public string? Error { get; private set; }
    public async Task<IActionResult> OnGetAsync()
    {
        Language = System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
        if (ParishId == Guid.Empty && tenant.ParishIds.Count == 1) ParishId = tenant.ParishIds.Single();
        if (Id is Guid id)
        {
            var record = await cases.GetAsync(id); if (record is null) return NotFound();
            if (record.Stage != CaseStage.Draft) return RedirectToPage("Detail", new { id, actingAs = tenant.ActingAssignmentId });
            SubjectName = record.SubjectName; Language = record.Language; Kind = record.Kind;
            ParishId = record.ParishId; Revision = record.Revision;
            using var json = JsonDocument.Parse(record.FactsJson);
            Details = json.RootElement.TryGetProperty("details", out var value) ? value.GetString() ?? "" : "";
        }
        await LoadParishesAsync();
        return Page();
    }
    private async Task LoadParishesAsync()
    {
        var rows = await db.Parishes.IgnoreQueryFilters().Where(p => p.PubliclyListed && p.Lifecycle == "Active" || tenant.ParishIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name }).ToListAsync();
        Parishes = rows.Select(p => (p.Id, p.Name)).ToList();
    }
    public async Task<IActionResult> OnPostAsync(bool submit)
    {
        try
        {
            var result = await SaveAsync(submit);
            return RedirectToPage("Detail", new { id = result.Id, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadParishesAsync(); return Page(); }
    }
    public async Task<IActionResult> OnPostSaveDraftAsync()
    {
        try
        {
            var result = await SaveAsync(false);
            return new JsonResult(new { id = result.Id, revision = result.Revision, operationId = Guid.NewGuid() });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException)
        { return new JsonResult(new { error = ex.Message }) { StatusCode = 400 }; }
    }
    private Task<ParishLive.Infrastructure.Data.OperationResult> SaveAsync(bool submit) => Id is Guid id
        ? cases.SaveDraftAsync(id, Revision, SubjectName, JsonSerializer.Serialize(new { details = Details }), Language, submit, OperationId)
        : cases.CreateAsync(new NewCase(ParishId, Kind, SubjectName, Language, JsonSerializer.Serialize(new { details = Details }), submit, OperationId));
}
