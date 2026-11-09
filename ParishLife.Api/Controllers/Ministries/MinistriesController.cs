// Purpose: exposes authenticated ministry drafts, lifecycle and discovery through explicit response DTOs.
// Main functions: Create, Update, Get, MemberInfo, List and Act delegate authority and persistence rules while keeping member and office projections distinct.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries")]
public class MinistriesController(MinistryService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<MinistryDto>> Create(Guid parishId, SaveMinistryDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), null, request, ct));
    [HttpPut("{ministryId:guid}")]
    public async Task<ActionResult<MinistryDto>> Update(Guid parishId, Guid ministryId, SaveMinistryDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(ministryId), request, ct));
    [HttpGet("{ministryId:guid}")]
    public async Task<ActionResult<Versioned<MinistryDto>>> Get(Guid parishId, Guid ministryId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(ministryId), ct));
    [HttpGet("{ministryId:guid}/member-info")]
    public async Task<ActionResult<MemberMinistryDto>> MemberInfo(Guid parishId, Guid ministryId, CancellationToken ct)
        => Ok(await service.MemberInfoAsync(Guard.Id(parishId), Guard.Id(ministryId), ct));
    [HttpGet]
    public async Task<ActionResult<Page<Versioned<MinistryDto>>>> List(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), size, cursor, ct));
    [HttpPost("{ministryId:guid}/actions")]
    public async Task<ActionResult<MinistryDto>> Act(Guid parishId, Guid ministryId, MinistryActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(ministryId), request, ct));
}
