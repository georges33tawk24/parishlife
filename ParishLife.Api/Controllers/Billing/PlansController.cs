// Purpose: handles the PlansController HTTP routes through backend services and explicit DTO projections.
// Main functions: the declared routes apply authentication, bind validated DTOs, and return authorized results.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Services.Billing;

namespace ParishLife.Api.Controllers.Billing;

[Authorize, ApiController, Route("api/plans")]
public sealed class PlansController(BillingService service) : ControllerBase
{
    [HttpGet, AllowAnonymous]
    public async Task<IActionResult> List(CancellationToken ct) => Ok((await service.ListPlansAsync(ct)).Select(PlanDto.From));
    [HttpPost]
    public async Task<IActionResult> Publish(PublishPlanDto request, CancellationToken ct) => Ok(PlanDto.From(await service.PublishPlanAsync(request, ct)));
}
