using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Public;

[EnableRateLimiting("GuestIntake")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TrackModel(GuestIntakeService guests) : PageModel
{
    [BindProperty] public string Secret { get; set; } = "";
    public GuestStatus? Record { get; private set; }
    public bool LookedUp { get; private set; }
    public void OnGet() { }
    public async Task OnPostAsync()
    {
        LookedUp = true; Record = await guests.StatusAsync(Secret ?? "");
        Response.Headers["Referrer-Policy"] = "no-referrer";
    }
}
