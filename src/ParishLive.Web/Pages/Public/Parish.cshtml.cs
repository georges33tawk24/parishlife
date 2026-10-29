using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Pages.Public;

public sealed class ParishModel(AppDbContext db) : PageModel
{
    public string Name { get; private set; } = "";
    public string Contact { get; private set; } = "";
    public string Locality { get; private set; } = "";
    public Guid ParishId { get; private set; }
    public bool GuestIntakeEnabled { get; private set; }
    public IReadOnlyList<string> Sections { get; private set; } = [];
    public async Task<IActionResult> OnGetAsync(Guid id)
    {
        var parish = await db.Parishes.IgnoreQueryFilters().AsNoTracking().Where(p => p.Id == id && p.PubliclyListed && p.Lifecycle == "Active")
            .Select(p => new { p.Name, p.NameFrench, p.NameArabic, p.Locality, p.OfficeContact, p.GuestIntakeEnabled }).SingleOrDefaultAsync();
        if (parish is null) return NotFound();
        var lang = System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
        Name = lang == "ar" ? parish.NameArabic ?? parish.Name : lang == "fr" ? parish.NameFrench ?? parish.Name : parish.Name;
        Contact = parish.OfficeContact ?? ""; Locality = parish.Locality ?? "";
        ParishId = id; GuestIntakeEnabled = parish.GuestIntakeEnabled;
        var snapshots = await db.ContentPages.IgnoreQueryFilters().AsNoTracking().Where(p => p.ParishId == id && p.PublishedJson != null)
            .Select(p => p.PublishedJson!).ToListAsync();
        Sections = snapshots.Select(json => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(json)?.GetValueOrDefault(lang, "") ?? "").ToList();
        return Page();
    }
}
