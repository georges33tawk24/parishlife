// Purpose: accepts anonymous public-site metric beacons (rate limited per connection; the address is never stored).
// Main function: Record delegates to SiteInsightsService and always answers 202 without saying whether the count was kept.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Services.Reporting;

namespace ParishLife.Api.Controllers.Reporting;

[AllowAnonymous, ApiController, EnableRateLimiting("authentication"), Route("api/public/site-metrics")]
public class SiteMetricsController(SiteInsightsService service) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Record(RecordSiteMetricDto request, CancellationToken ct)
    {
        await service.RecordAsync(request, ct);
        return Accepted();
    }
}
