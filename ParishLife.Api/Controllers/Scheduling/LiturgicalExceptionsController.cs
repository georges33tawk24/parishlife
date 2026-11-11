// Purpose: exposes parish liturgical exceptions (X12) to appointed priests over HTTP.
// Main functions: List, Record and Withdraw delegate to LiturgicalCalendarService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/liturgical-exceptions")]
public class LiturgicalExceptionsController(LiturgicalCalendarService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Versioned<LiturgicalExceptionDto>>>> List(Guid parishId, CancellationToken ct)
        => Ok(await service.ExceptionsAsync(Guard.Id(parishId), ct));

    [HttpPost]
    public async Task<ActionResult<Versioned<LiturgicalExceptionDto>>> Record(Guid parishId, SaveLiturgicalExceptionDto request, CancellationToken ct)
        => Ok(await service.RecordExceptionAsync(Guard.Id(parishId), request, ct));

    [HttpPost("{exceptionId:guid}/withdraw")]
    public async Task<ActionResult<Versioned<LiturgicalExceptionDto>>> Withdraw(Guid parishId, Guid exceptionId, LiturgicalActionDto request, CancellationToken ct)
        => Ok(await service.WithdrawExceptionAsync(Guard.Id(parishId), Guard.Id(exceptionId), request, ct));
}
