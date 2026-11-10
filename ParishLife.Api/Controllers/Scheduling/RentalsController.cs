// Purpose: exposes external renters and reservation rental agreements over HTTP.
// Main functions: CreateRenter, Renters, Propose, Act and Get delegate rules to RentalService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class RentalsController(RentalService service) : ControllerBase
{
    [HttpPost("renters")]
    public async Task<ActionResult<RenterDto>> CreateRenter(Guid parishId, SaveRenterDto request, CancellationToken ct)
        => Ok(await service.CreateRenterAsync(Guard.Id(parishId), request, ct));

    [HttpGet("renters")]
    public async Task<ActionResult<IReadOnlyList<RenterDto>>> Renters(Guid parishId, CancellationToken ct)
        => Ok(await service.RentersAsync(Guard.Id(parishId), ct));

    [HttpPut("reservations/{reservationId:guid}/rental")]
    public async Task<ActionResult<RentalAgreementDto>> Propose(Guid parishId, Guid reservationId, ProposeRentalDto request, CancellationToken ct)
        => Ok(await service.ProposeAsync(Guard.Id(parishId), Guard.Id(reservationId), request, ct));

    [HttpPost("reservations/{reservationId:guid}/rental/actions")]
    public async Task<ActionResult<RentalAgreementDto>> Act(Guid parishId, Guid reservationId, RentalActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(reservationId), request, ct));

    [HttpGet("reservations/{reservationId:guid}/rental")]
    public async Task<ActionResult<RentalAgreementDto>> Get(Guid parishId, Guid reservationId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(reservationId), ct));
}
