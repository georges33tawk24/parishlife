using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Common;
using ParishLive.Application.Reservations;
using ParishLive.Domain.Common;

namespace ParishLive.Web.Pages.Reservations;

[Authorize]
public class DetailModel(IReservationService reservations) : PageModel
{
    public ReservationDetail? R { get; private set; }

    [BindProperty]
    public string? Note { get; set; }

    public string? Error { get; private set; }

    public async Task<IActionResult> OnGetAsync(Guid id)
    {
        R = await reservations.GetAsync(id);
        return R is null ? NotFound() : Page();
    }

    public async Task<IActionResult> OnPostAsync(Guid id, string action)
    {
        var actor = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        try
        {
            await reservations.PerformActionAsync(id, action, Note, actor);
            return RedirectToPage(new { id });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException)
        {
            Error = ex.Message;                 // e.g. "A note is required to reject." / permission denied
            R = await reservations.GetAsync(id);
            return Page();
        }
    }
}
