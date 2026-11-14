// Purpose: exposes the later registration options over HTTP: editing a policy's terms, applying a discount, household registration,
// pickup codes and evacuation roll calls for one calendar event.
// Main functions: ReviseTerms, ApplyDiscount, RegisterHousehold, PickupCode, StartEvacuation, Evacuations, Evacuation and EvacuationAction;
// the services enforce authority, versions and idempotency, and this controller maps stored records to response DTOs.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Registrations;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/calendar/events/{eventId:guid}")]
public class EventRegistrationOptionsController(RegistrationService registrations, RegistrationTermsService terms, EvacuationService evacuations) : ControllerBase
{
    [HttpPost("registration/terms")]
    public async Task<ActionResult<RegistrationPolicyDto>> ReviseTerms(Guid parishId, Guid eventId, ReviseRegistrationTermsDto request, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await terms.ReviseTermsAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct)));

    [HttpPost("registrations/{registrationId:guid}/discount")]
    public async Task<ActionResult<EventRegistrationDto>> ApplyDiscount(Guid parishId, Guid eventId, Guid registrationId, ApplyRegistrationDiscountDto request, CancellationToken ct)
        => Ok(await registrations.StaffViewAsync(await terms.ApplyDiscountAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), request, ct), ct));

    [HttpPost("registrations/household")]
    public async Task<ActionResult<EventRegistrationDto[]>> RegisterHousehold(Guid parishId, Guid eventId, RegisterHouseholdDto request, CancellationToken ct)
        => Ok((await terms.RegisterHouseholdAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct)).Select(registrations.StaffView).ToArray());

    [HttpPost("registrations/{registrationId:guid}/pickup-code")]
    public async Task<ActionResult<PickupCodeResultDto>> PickupCode(Guid parishId, Guid eventId, Guid registrationId, PickupCodeActionDto request, CancellationToken ct)
        => Ok(await terms.PickupCodeAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), request, ct));

    [HttpPost("evacuations")]
    public async Task<ActionResult<Versioned<EvacuationDto>>> StartEvacuation(Guid parishId, Guid eventId, StartEvacuationDto request, CancellationToken ct)
        => Ok(await evacuations.StartAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct));

    [HttpGet("evacuations")]
    public async Task<ActionResult<IReadOnlyList<Versioned<EvacuationDto>>>> Evacuations(Guid parishId, Guid eventId, CancellationToken ct)
        => Ok(await evacuations.ListAsync(Guard.Id(parishId), Guard.Id(eventId), ct));

    [HttpGet("evacuations/{evacuationId:guid}")]
    public async Task<ActionResult<Versioned<EvacuationDto>>> Evacuation(Guid parishId, Guid eventId, Guid evacuationId, CancellationToken ct)
        => Ok(await evacuations.GetAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(evacuationId), ct));

    [HttpPost("evacuations/{evacuationId:guid}/actions")]
    public async Task<ActionResult<Versioned<EvacuationDto>>> EvacuationAction(Guid parishId, Guid eventId, Guid evacuationId, EvacuationActionDto request, CancellationToken ct)
        => Ok(await evacuations.ActAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(evacuationId), request, ct));
}
