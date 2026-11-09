// Purpose: exposes private departure reasons only through the applicant/priest service boundary.
// Main functions: Save and Get use typed DTOs; ordinary leader/office and recovery sessions remain unauthorized.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}/applications/{applicationId:guid}/private-reason")]
public class MinistryDeparturesController(MinistryDepartureService service) : ControllerBase
{
    [HttpPut]
    public async Task<ActionResult<PrivateDepartureDto>> Save(Guid parishId, Guid ministryId, Guid applicationId, PrivateDepartureReasonDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(applicationId), request, ct));
    [HttpGet]
    public async Task<ActionResult<Versioned<PrivateDepartureDto>>> Get(Guid parishId, Guid ministryId, Guid applicationId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(applicationId), ct));
}
