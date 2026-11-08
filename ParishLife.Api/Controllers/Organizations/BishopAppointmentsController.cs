// Purpose: exposes the first-bishop proposal, independent review, and nominee invitation API without creating startup data.
// Main functions: Propose, Review, Decide, Get delegate all authority and state checks to BishopAppointmentService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize]
[ApiController]
[Route("api/archdioceses/{archdioceseId:guid}/bishop-appointments")]
public class BishopAppointmentsController(BishopAppointmentService service, TimeProvider clock) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Propose(Guid archdioceseId, ProposeBishopAppointmentDto request, CancellationToken ct)
        => Ok(BishopAppointmentDto.From(await service.ProposeAsync(Guard.Id(archdioceseId), request, ct), clock.GetUtcNow(), includeEvidence: true));

    [HttpPost("{appointmentId:guid}/review")]
    public async Task<IActionResult> Review(Guid archdioceseId, Guid appointmentId, ReviewBishopAppointmentDto request, CancellationToken ct)
        => Ok(BishopAppointmentDto.From(await service.ReviewAsync(Guard.Id(archdioceseId), Guard.Id(appointmentId), request, ct), clock.GetUtcNow(), includeEvidence: true));

    [HttpPost("{appointmentId:guid}/response")]
    public async Task<IActionResult> Decide(Guid archdioceseId, Guid appointmentId, DecideBishopInvitationDto request, CancellationToken ct)
        => Ok(BishopAppointmentDto.From(await service.DecideAsync(Guard.Id(archdioceseId), Guard.Id(appointmentId), request, ct), clock.GetUtcNow()));

    [HttpGet("{appointmentId:guid}")]
    public async Task<IActionResult> Get(Guid archdioceseId, Guid appointmentId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(archdioceseId), Guard.Id(appointmentId), ct));
}
