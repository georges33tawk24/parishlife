using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Infrastructure.Data;
using ParishLive.Application.Abstractions;
using Microsoft.AspNetCore.Mvc;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Readiness;

[Authorize]
public sealed class IndexModel(AppDbContext db, ITenantContext tenant, PolicyService policies, GuestIntakeService guests) : PageModel
{
    public IReadOnlyDictionary<string, bool> Checks { get; private set; } = new Dictionary<string, bool>();
    public IReadOnlyList<Parish> Parishes { get; private set; } = [];
    public ParishPolicy? Policy { get; private set; }
    public string? Error { get; private set; }
    public string? Role => tenant.ActingRole;
    [BindProperty(SupportsGet = true)] public Guid ParishId { get; set; }
    public async Task OnGetAsync() => await LoadAsync();
    private async Task LoadAsync()
    {
        Parishes = await db.Parishes.AsNoTracking().ToListAsync();
        if (ParishId == Guid.Empty && Parishes.Count == 1) ParishId = Parishes[0].Id;
        Policy = Parishes.Any(p => p.Id == ParishId) ? await db.ParishPolicies.AsNoTracking().SingleOrDefaultAsync(p => p.ParishId == ParishId) : null;
        Checks = new Dictionary<string, bool> {
            ["Religious"] = Policy?.ReligiousRequirementsApproved == true,
            ["Templates"] = Policy?.OfficialTemplatesApproved == true,
            ["Finance"] = Policy?.FinancePolicyApproved == true,
            ["Safeguarding"] = Policy?.SafeguardingPolicyApproved == true && Policy.SafeguardingLeadUserId != null,
            ["Delivery"] = false, ["Maps"] = false, ["Backup"] = false, ["LanguageReview"] = false };
    }
    public async Task<IActionResult> OnPostAsync(string area, long revision, string reference, bool confirmed,
        string? requirements, string? registerSeries, string? eventLeadUserId, bool allowEntryProxy,
        bool allowCertificateProxy, Guid operationId)
    {
        try
        {
            await policies.RecordAsync(new(ParishId, revision, area, reference, confirmed,
                (requirements ?? "").Split('\n', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries),
                registerSeries, eventLeadUserId, allowEntryProxy, allowCertificateProxy, operationId));
            return RedirectToPage(new { ParishId, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
    public async Task<IActionResult> OnPostIntakeAsync(bool enabled, ServiceKind[] kinds, string reference, bool confirmed, Guid operationId)
    {
        try { await guests.ConfigureAsync(db, tenant, ParishId, enabled, kinds, reference, confirmed, operationId); return RedirectToPage(new { ParishId, actingAs = tenant.ActingAssignmentId }); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
}
