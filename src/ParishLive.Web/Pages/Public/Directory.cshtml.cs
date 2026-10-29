using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;

namespace ParishLive.Web.Pages.Public;

public sealed class DirectoryModel(AppDbContext db, ITenantContext tenant, FollowingService follows) : PageModel
{
    public sealed record ParishCard(Guid Id, string Name, string Locality, string Contact);
    [BindProperty(SupportsGet = true)] public string? Search { get; set; }
    public IReadOnlyList<ParishCard> Items { get; private set; } = [];
    public IReadOnlyDictionary<Guid, bool> Following { get; private set; } = new Dictionary<Guid, bool>();
    public string? Error { get; private set; }
    public async Task OnGetAsync()
    {
        var culture = System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
        // Only the approved public projection crosses this deliberate query-filter bypass.
        var rows = await db.Parishes.IgnoreQueryFilters().AsNoTracking().Where(p => p.PubliclyListed && p.Lifecycle == "Active")
            .Select(p => new { p.Id, p.Name, p.NameFrench, p.NameArabic, p.Locality, p.OfficeContact }).ToListAsync();
        Items = rows.Where(p => string.IsNullOrWhiteSpace(Search) ||
            new[] { p.Name, p.NameFrench, p.NameArabic, p.Locality }.Any(v => v?.Contains(Search, StringComparison.OrdinalIgnoreCase) == true))
            .Select(p => new ParishCard(p.Id, culture == "ar" ? p.NameArabic ?? p.Name : culture == "fr" ? p.NameFrench ?? p.Name : p.Name,
                p.Locality ?? "", p.OfficeContact ?? "")).ToList();
        Following = await db.ParishFollows.AsNoTracking().Where(f => f.UserId == tenant.UserId).ToDictionaryAsync(f => f.ParishId, f => f.IsPrimary);
    }
    public async Task<IActionResult> OnPostAsync(Guid parishId, bool following, bool primary, Guid operationId)
    {
        if (User.Identity?.IsAuthenticated != true) return Challenge();
        try { await follows.SetAsync(parishId, following, primary, operationId); return RedirectToPage(); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await OnGetAsync(); return Page(); }
    }
}
