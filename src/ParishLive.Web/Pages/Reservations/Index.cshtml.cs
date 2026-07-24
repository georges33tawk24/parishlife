using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Reservations;

namespace ParishLive.Web.Pages.Reservations;

[Authorize]
public class IndexModel(IReservationService reservations) : PageModel
{
    public IReadOnlyList<ReservationListItem> Items { get; private set; } = [];

    public async Task OnGetAsync() => Items = await reservations.ListAsync();
}
