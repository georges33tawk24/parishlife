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

namespace ParishLive.Web.Pages.People;

[Authorize]
public sealed class RecordsModel(PeopleService people, OperationalAccess access, AppDbContext db, ITenantContext tenant) : PageModel
{
    [BindProperty] public string SuppliedName { get; set; } = "";
    [BindProperty] public string? ArabicName { get; set; }
    [BindProperty] public string? FrenchName { get; set; }
    [BindProperty] public string? BirthDate { get; set; }
    [BindProperty] public string DatePrecision { get; set; } = "Unknown";
    [BindProperty] public string Source { get; set; } = "";
    [BindProperty] public string? DifferentPersonEvidence { get; set; }
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    public IReadOnlyList<PersonRecord> Items { get; private set; } = [];
    public string? Error { get; private set; }
    public async Task OnGetAsync()
    {
        try { await access.OfficeAsync(tenant.ParishIds.SingleOrDefault()); Items = await db.People.AsNoTracking().ToListAsync(); }
        catch (ForbiddenException) { Error = "Error.Unavailable"; }
    }
    public async Task<IActionResult> OnPostAsync()
    {
        try
        {
            await people.SaveAsync(new PersonInput(tenant.ParishIds.SingleOrDefault(), null, 0, SuppliedName, ArabicName, FrenchName,
                BirthDate, DatePrecision, Source, DifferentPersonEvidence, OperationId));
            return RedirectToPage(new { actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await OnGetAsync(); return Page(); }
    }
}
