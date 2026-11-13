// Purpose: lets the parish office open the sacramental case or certificate an accepted request needs, through the existing services.
// Main function: Open delegates to RequestRecordService.OpenAsync (idempotent by operation id; links the record to the case).

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Requests;

namespace ParishLife.Api.Controllers.Requests;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/requests/{requestId:guid}/records")]
public class RequestRecordsController(RequestRecordService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<OpenedRequestRecordDto>> Open(Guid parishId, Guid requestId, OpenRequestRecordDto request, CancellationToken ct)
        => Ok(await service.OpenAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));
}
