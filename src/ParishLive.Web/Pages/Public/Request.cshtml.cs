using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Public;

[EnableRateLimiting("GuestIntake")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class RequestModel(AppDbContext db, GuestIntakeService guests) : PageModel
{
    public string ParishName { get; private set; } = "";
    public IReadOnlyList<ServiceKind> Kinds { get; private set; } = [];
    public string? Error { get; private set; }
    [BindProperty(SupportsGet = true)] public Guid ParishId { get; set; }
    [BindProperty] public string SubjectName { get; set; } = "";
    [BindProperty] public string Contact { get; set; } = "";
    [BindProperty] public string Details { get; set; } = "";
    [BindProperty] public ServiceKind Kind { get; set; }
    [BindProperty] public string SubmissionSecret { get; set; } = GuestIntakeService.NewSecret();
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    public async Task<IActionResult> OnGetAsync() => await LoadAsync() ? Page() : NotFound();
    private async Task<bool> LoadAsync()
    {
        var parish = await db.Parishes.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(p =>
            p.Id == ParishId && p.PubliclyListed && p.Lifecycle == "Active" && p.GuestIntakeEnabled);
        if (parish is null) return false;
        var language = System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
        ParishName = language == "ar" ? parish.NameArabic ?? parish.Name : language == "fr" ? parish.NameFrench ?? parish.Name : parish.Name;
        var allowed = System.Text.Json.JsonSerializer.Deserialize<string[]>(parish.GuestRequestKindsJson) ?? [];
        Kinds = Enum.GetValues<ServiceKind>().Where(k => allowed.Contains(k.ToString())).ToList();
        return Kinds.Count > 0;
    }
    public async Task<IActionResult> OnPostAsync()
    {
        if (!await LoadAsync()) return NotFound();
        try
        {
            await guests.SubmitAsync(new(ParishId, Kind, SubjectName, Contact, Details,
                System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName, SubmissionSecret, OperationId));
            // The capability is in the fragment, never in an HTTP URL, referer or server access log.
            return Redirect("/Public/Track#" + SubmissionSecret);
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException)
        { Error = ex.Message; return Page(); }
    }
}
