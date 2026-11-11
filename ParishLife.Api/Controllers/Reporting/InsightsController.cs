// Purpose: exposes Super Admin Insights (aggregate public-site counts and parish setup coverage) to current MFA platform operators.
// Main function: Insights delegates to SiteInsightsService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Services.Reporting;

namespace ParishLife.Api.Controllers.Reporting;

[Authorize, ApiController, Route("api/administration/insights")]
public class InsightsController(SiteInsightsService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PlatformInsightsDto>> Insights([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
        => Ok(await service.InsightsAsync(from, to, ct));
}
