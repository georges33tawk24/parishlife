using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Events;
using ParishLive.Domain.Common;

namespace ParishLive.Web.Pages.Events;

[Authorize]
public class IndexModel(IEventService events) : PageModel
{
    public IReadOnlyList<EventListItem> Upcoming { get; private set; } = [];

    [TempData]
    public string? Message { get; set; }

    public async Task OnGetAsync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Upcoming = await events.ListUpcomingAsync(userId);
    }

    public async Task<IActionResult> OnPostRegisterAsync(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        try
        {
            await events.RegisterAsync(id, userId);
        }
        catch (DomainException ex)
        {
            Message = ex.Message;
        }
        return RedirectToPage();
    }
}
