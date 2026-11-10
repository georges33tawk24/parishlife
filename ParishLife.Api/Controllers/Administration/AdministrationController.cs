// Purpose: HTTP endpoints for administration workflows; delegates work to backend services.
// Main functions: Verification, ArchdioceseVerification, Invoice, Readiness and Capabilities.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Billing;
using ParishLife.Api.Services.Operations;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Administration;

[Authorize, ApiController, Route("api/administration")]
public sealed class AdministrationController(ParishService parishes, BillingService billing) : ControllerBase
{
    [HttpGet("parish-verifications/{parishId:guid}")]
    public async Task<IActionResult> Verification(Guid parishId, CancellationToken ct)
    {
        var row = await parishes.InspectVerificationAsync(Guard.Id(parishId), ct);
        return Ok(new Versioned<ParishVerificationDto> { Value = ParishVerificationDto.From(row.Value), Version = row.Version });
    }

    [HttpGet("archdiocese-verifications/{organizationId:guid}")]
    public async Task<IActionResult> ArchdioceseVerification(Guid organizationId, CancellationToken ct)
    {
        var row = await parishes.InspectArchdioceseVerificationAsync(Guard.Id(organizationId), ct);
        return Ok(new Versioned<ArchdioceseDto> { Value = ArchdioceseDto.From(row.Value), Version = row.Version });
    }

    [HttpGet("parishes/{parishId:guid}/invoices/{invoiceId:guid}")]
    public async Task<IActionResult> Invoice(Guid parishId, Guid invoiceId, CancellationToken ct) => Ok(await billing.InspectForOperatorAsync(Guard.Id(parishId), Guard.Id(invoiceId), ct));
    [HttpGet("readiness")]
    public async Task<IActionResult> Readiness([FromServices] IPlatformAccess platform, [FromServices] InfrastructureReadiness readiness, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        return Ok(await readiness.CheckAsync(ct));
    }

    // Any signed-in user may read what the platform can really do; it contains no secrets.
    [HttpGet("/api/capabilities")]
    public IActionResult Capabilities([FromServices] CapabilityService capabilities) => Ok(capabilities.List());
}
