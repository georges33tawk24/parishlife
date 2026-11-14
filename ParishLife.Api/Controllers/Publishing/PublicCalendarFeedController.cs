// Purpose: serves a verified parish's public calendar feed (.ics) to calendar apps, anonymously, rate limited per address and briefly cacheable.
// Main function: Feed delegates to ParishCalendarFeedService.

using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Publishing;

namespace ParishLife.Api.Controllers.Publishing;

[AllowAnonymous, ApiController, EnableRateLimiting("authentication"), Route("api/public/parishes/{parishId:guid}/calendar.ics")]
public class PublicCalendarFeedController(ParishCalendarFeedService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Feed(Guid parishId, CancellationToken ct)
    {
        var feed = await service.FeedAsync(Guard.Id(parishId), ct);
        Response.Headers.CacheControl = "public, max-age=900";
        return File(Encoding.UTF8.GetBytes(feed), "text/calendar; charset=utf-8");
    }
}
