// Purpose: exposes certificate requests, their preparation/signing/acceptance/issue/release actions, and the bishop's certificate policy.
// Main functions: Create, Act, Get, List and SetPolicy delegate authority and transitions to CertificateService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Sacraments;

namespace ParishLife.Api.Controllers.Sacraments;

[Authorize, ApiController]
public class CertificatesController(CertificateService service) : ControllerBase
{
    [HttpPost("api/parishes/{parishId:guid}/certificates")]
    public async Task<ActionResult<CertificateDto>> Create(Guid parishId, CreateCertificateDto request, CancellationToken ct)
        => Ok(await service.CreateAsync(Guard.Id(parishId), request, ct));

    [HttpPost("api/parishes/{parishId:guid}/certificates/{certificateId:guid}/actions")]
    public async Task<ActionResult<CertificateDto>> Act(Guid parishId, Guid certificateId, CertificateActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(certificateId), request, ct));

    [HttpGet("api/parishes/{parishId:guid}/certificates/{certificateId:guid}")]
    public async Task<ActionResult<Versioned<CertificateDto>>> Get(Guid parishId, Guid certificateId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(certificateId), ct));

    [HttpGet("api/parishes/{parishId:guid}/certificates")]
    public async Task<ActionResult<IReadOnlyList<Versioned<CertificateDto>>>> List(Guid parishId, CancellationToken ct, string? status = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), status, ct));

    [HttpPut("api/archdioceses/{archdioceseId:guid}/certificate-policy")]
    public async Task<ActionResult<CertificatePolicyStateDto>> SetPolicy(Guid archdioceseId, CertificatePolicyDto request, CancellationToken ct)
        => Ok(await service.SetPolicyAsync(Guard.Id(archdioceseId), request, ct));
}
