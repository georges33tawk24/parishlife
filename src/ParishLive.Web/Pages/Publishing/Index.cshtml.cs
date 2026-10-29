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

namespace ParishLive.Web.Pages.Publishing;

[Authorize]
public sealed class IndexModel(CommunityService community, OperationalAccess access, AppDbContext db, ITenantContext tenant) : PageModel
{
    [BindProperty] public Guid? Id { get; set; }
    [BindProperty] public long Revision { get; set; }
    [BindProperty] public string Slug { get; set; } = "";
    [BindProperty] public string English { get; set; } = "";
    [BindProperty] public string French { get; set; } = "";
    [BindProperty] public string Arabic { get; set; } = "";
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    public IReadOnlyList<ContentPage> Items { get; private set; } = [];
    public string? Error { get; private set; }
    public bool CanPublish => tenant.ActingRole == "Priest";
    public async Task OnGetAsync(Guid? edit)
    {
        await LoadAsync();
        if (edit is Guid id && Items.SingleOrDefault(i => i.Id == id) is { } item)
        {
            Id = item.Id; Revision = item.Revision; Slug = item.Slug;
            var translations = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(item.DraftJson) ?? [];
            English = translations.GetValueOrDefault("en", ""); French = translations.GetValueOrDefault("fr", ""); Arabic = translations.GetValueOrDefault("ar", "");
        }
    }
    private async Task LoadAsync()
    {
        try { await access.OfficeAsync(tenant.ParishIds.SingleOrDefault()); Items = await db.ContentPages.AsNoTracking().ToListAsync(); }
        catch (ForbiddenException) { Error = "Error.Unavailable"; }
    }
    public async Task<IActionResult> OnPostAsync(string action)
    {
        try
        {
            if (action == "Publish" && Id is Guid id) await community.PublishContentAsync(id, Revision, OperationId);
            else await community.SaveContentAsync(tenant.ParishIds.SingleOrDefault(), Id, Revision, Slug,
                new Dictionary<string, string> { ["en"] = English, ["fr"] = French, ["ar"] = Arabic }, OperationId);
            return RedirectToPage(new { actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
}
