using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Application.Reservations;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Pages.Reservations;

[Authorize]
public sealed class NewModel(IReservationService reservations, AppDbContext db, ITenantContext tenant) : PageModel
{
    [BindProperty] public Guid VenueId { get; set; }
    [BindProperty] public string Title { get; set; } = "";
    [BindProperty] public string? Description { get; set; }
    [BindProperty] public DateTime? StartLocal { get; set; }
    [BindProperty] public DateTime? EndLocal { get; set; }
    [BindProperty] public int ExpectedAttendees { get; set; } = 1;
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    public IReadOnlyList<Venue> Venues { get; private set; } = [];
    public string? Error { get; private set; }
    public async Task OnGetAsync() => Venues = await db.Venues.AsNoTracking().Where(v => v.IsServiceable).ToListAsync();
    public async Task<IActionResult> OnPostAsync()
    {
        try
        {
            if (StartLocal is null || EndLocal is null) throw new DomainException("Error.Invalid");
            var parish = await db.Parishes.SingleAsync(p => p.Id == tenant.ParishIds.Single());
            var zone = TimeZoneInfo.FindSystemTimeZoneById(parish.TimeZone);
            var start = DateTime.SpecifyKind(StartLocal.Value, DateTimeKind.Unspecified);
            var end = DateTime.SpecifyKind(EndLocal.Value, DateTimeKind.Unspecified);
            if (zone.IsInvalidTime(start) || zone.IsAmbiguousTime(start) || zone.IsInvalidTime(end) || zone.IsAmbiguousTime(end))
                throw new DomainException("Error.TimeZone");
            var id = await reservations.CreateAsync(new CreateReservationRequest(null, VenueId, tenant.UserId ?? "", Title, Description,
                TimeZoneInfo.ConvertTimeToUtc(start, zone), TimeZoneInfo.ConvertTimeToUtc(end, zone), ExpectedAttendees, OperationId));
            return RedirectToPage("Detail", new { id, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await OnGetAsync(); return Page(); }
    }
}
