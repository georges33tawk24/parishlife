// Purpose: exposes office booking intake, actual reservation state and asynchronous confirmation/cancellation actions.
// Main functions: Create, Get, List, Act return 202 only while durable work is pending; no endpoint invokes privileged worker internals.
// Details replaces the descriptive details (purpose, attendance, contact, notes, checklist) without touching the allocation.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/reservations")]
public class ReservationsController(ReservationService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ReservationDto>> Create(Guid parishId, ReserveDto request, CancellationToken ct) => Ok(await service.RequestAsync(Guard.Id(parishId), request, ct));
    [HttpGet("{reservationId:guid}")]
    public async Task<ActionResult<Versioned<ReservationDto>>> Get(Guid parishId, Guid reservationId, CancellationToken ct) => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(reservationId), ct));
    [HttpGet]
    public async Task<ActionResult<Page<Versioned<ReservationDto>>>> List(Guid parishId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), start, end, size, cursor, ct));
    [HttpPost("{reservationId:guid}/actions")]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ReservationDto>> Act(Guid parishId, Guid reservationId, ReservationActionDto request, CancellationToken ct)
    {
        var value = await service.ActAsync(Guard.Id(parishId), Guard.Id(reservationId), request, ct);
        return value.Status is "Allocating" or "Cancelling" ? Accepted(value) : Ok(value);
    }
    [HttpPut("{reservationId:guid}/details")]
    public async Task<ActionResult<ReservationDto>> Details(Guid parishId, Guid reservationId, SaveReservationDetailsDto request, CancellationToken ct)
        => Ok(await service.DetailsAsync(Guard.Id(parishId), Guard.Id(reservationId), request, ct));
}
