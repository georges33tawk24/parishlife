using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Private;

[Authorize]
public sealed class IndexModel(PrivateWorkService work, ITenantContext tenant) : PageModel
{
    [BindProperty] public string Title { get; set; } = "";
    [BindProperty] public string Body { get; set; } = "";
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    public IReadOnlyList<PrivateNoteView> Notes { get; private set; } = [];
    public string? Error { get; private set; }
    public async Task OnGetAsync() => Notes = await work.NotesAsync();
    public async Task<IActionResult> OnPostAsync()
    {
        try { await work.SaveNoteAsync(tenant.ParishIds.SingleOrDefault(), null, 0, Title, Body, "Author", null, false, OperationId); return RedirectToPage(new { actingAs = tenant.ActingAssignmentId }); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await OnGetAsync(); return Page(); }
    }
}
