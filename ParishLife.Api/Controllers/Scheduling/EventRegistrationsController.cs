// Purpose: exposes event registration policy/forms, office and own registrations, money movements, refunds and door presence over HTTP.
// Main functions: Configure, Policy, PolicyAction, ReviseForm, Form, ApplicantForm, Register, List, Get, Act, Amend, Mine, RegisterOwn,
// CancelOwn, DoorList, DoorRegistration, CashierList, CashierRegistration, Receipt, Movements, RequestRefund, Refunds, RefundAction,
// Presence and Present; the service enforces authority, versioned applicant consent/form context and transitions,
// and this controller maps stored records to response DTOs.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Registrations;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/calendar/events/{eventId:guid}")]
public class EventRegistrationsController(RegistrationService service) : ControllerBase
{
    [HttpPost("registration")]
    public async Task<ActionResult<RegistrationPolicyDto>> Configure(Guid parishId, Guid eventId, ConfigureRegistrationDto request, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.ConfigureAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct)));

    [HttpGet("registration")]
    public async Task<ActionResult<Versioned<RegistrationPolicyDto>>> Policy(Guid parishId, Guid eventId, CancellationToken ct)
    {
        var row = await service.PolicyAsync(Guard.Id(parishId), Guard.Id(eventId), ct);
        return Ok(new Versioned<RegistrationPolicyDto> { Version = row.Version, Value = RegistrationService.ToDto(row.Value) });
    }

    [HttpPost("registration/actions")]
    public async Task<ActionResult<RegistrationPolicyDto>> PolicyAction(Guid parishId, Guid eventId, RegistrationPolicyActionDto request, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.PolicyActionAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct)));

    [HttpPost("registration/forms")]
    public async Task<ActionResult<RegistrationPolicyDto>> ReviseForm(Guid parishId, Guid eventId, ReviseFormDto request, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.ReviseFormAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct)));

    [HttpGet("registration/forms/{formId:guid}")]
    public async Task<ActionResult<RegistrationFormDto>> Form(Guid parishId, Guid eventId, Guid formId, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.FormAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(formId), ct)));

    [HttpGet("registration/applicant-form")]
    public async Task<ActionResult<RegistrationApplicantFormDto>> ApplicantForm(Guid parishId, Guid eventId, CancellationToken ct)
        => Ok(await service.ApplicantFormAsync(Guard.Id(parishId), Guard.Id(eventId), ct));

    [HttpPost("registrations")]
    public async Task<ActionResult<EventRegistrationDto>> Register(Guid parishId, Guid eventId, RegisterParticipantDto request, CancellationToken ct)
        => Ok(service.StaffView(await service.RegisterAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct)));

    [HttpGet("registrations")]
    public async Task<ActionResult<Page<Versioned<EventRegistrationDto>>>> List(Guid parishId, Guid eventId, CancellationToken ct, int size = 25, string? cursor = null)
    {
        var page = await service.ListAsync(Guard.Id(parishId), Guard.Id(eventId), size, cursor, ct);
        return Ok(new Page<Versioned<EventRegistrationDto>>
        {
            Items = page.Items.Select(row => new Versioned<EventRegistrationDto> { Version = row.Version, Value = service.StaffView(row.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        });
    }

    [HttpGet("registrations/door")]
    public async Task<ActionResult<Page<Versioned<DoorRegistrationDto>>>> DoorList(Guid parishId, Guid eventId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.DoorListAsync(Guard.Id(parishId), Guard.Id(eventId), size, cursor, ct));

    [HttpGet("registrations/{registrationId:guid}/door")]
    public async Task<ActionResult<Versioned<DoorRegistrationDto>>> DoorRegistration(Guid parishId, Guid eventId, Guid registrationId, CancellationToken ct)
        => Ok(await service.DoorRegistrationAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), ct));

    [HttpGet("registrations/cashier")]
    public async Task<ActionResult<Page<Versioned<CashierRegistrationDto>>>> CashierList(Guid parishId, Guid eventId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.CashierListAsync(Guard.Id(parishId), Guard.Id(eventId), size, cursor, ct));

    [HttpGet("registrations/{registrationId:guid}/cashier")]
    public async Task<ActionResult<Versioned<CashierRegistrationDto>>> CashierRegistration(Guid parishId, Guid eventId, Guid registrationId, CancellationToken ct)
        => Ok(await service.CashierRegistrationAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), ct));

    [HttpGet("registrations/mine")]
    public async Task<ActionResult<Versioned<EventRegistrationDto>>> Mine(Guid parishId, Guid eventId, CancellationToken ct)
        => Ok(await service.OwnAsync(Guard.Id(parishId), Guard.Id(eventId), ct));

    [HttpPost("registrations/mine")]
    public async Task<ActionResult<EventRegistrationDto>> RegisterOwn(Guid parishId, Guid eventId, RegisterOwnDto request, CancellationToken ct)
        => Ok(await service.RegisterOwnAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct));

    [HttpPost("registrations/mine/cancel")]
    public async Task<ActionResult<EventRegistrationDto>> CancelOwn(Guid parishId, Guid eventId, CancelOwnRegistrationDto request, CancellationToken ct)
        => Ok(await service.CancelOwnAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct));

    [HttpGet("registrations/{registrationId:guid}")]
    public async Task<ActionResult<Versioned<EventRegistrationDto>>> Get(Guid parishId, Guid eventId, Guid registrationId, CancellationToken ct)
    {
        var row = await service.GetAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), ct);
        return Ok(new Versioned<EventRegistrationDto> { Version = row.Version, Value = service.StaffView(row.Value) });
    }

    [HttpPost("registrations/{registrationId:guid}/actions")]
    public async Task<ActionResult<EventRegistrationDto>> Act(Guid parishId, Guid eventId, Guid registrationId, RegistrationActionDto request, CancellationToken ct)
        => Ok(service.StaffView(await service.ActAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), request, ct)));

    [HttpPost("registrations/{registrationId:guid}/amend")]
    public async Task<ActionResult<EventRegistrationDto>> Amend(Guid parishId, Guid eventId, Guid registrationId, AmendParticipantDto request, CancellationToken ct)
        => Ok(service.StaffView(await service.AmendAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), request, ct)));

    [HttpPost("registrations/{registrationId:guid}/receipts")]
    public async Task<ActionResult<RegistrationMovementDto>> Receipt(Guid parishId, Guid eventId, Guid registrationId, RecordEventReceiptDto request, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.ReceiptAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), request, ct)));

    [HttpGet("registrations/{registrationId:guid}/movements")]
    public async Task<ActionResult<Page<Versioned<RegistrationMovementDto>>>> Movements(Guid parishId, Guid eventId, Guid registrationId, CancellationToken ct,
        int size = 25, string? cursor = null)
    {
        var page = await service.MovementsAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), size, cursor, ct);
        return Ok(new Page<Versioned<RegistrationMovementDto>>
        {
            Items = page.Items.Select(row => new Versioned<RegistrationMovementDto> { Version = row.Version, Value = RegistrationService.ToDto(row.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        });
    }

    [HttpPost("registrations/{registrationId:guid}/refunds")]
    public async Task<ActionResult<RegistrationRefundDto>> RequestRefund(Guid parishId, Guid eventId, Guid registrationId, RequestEventRefundDto request, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.RequestRefundAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), request, ct)));

    [HttpGet("registrations/{registrationId:guid}/refunds")]
    public async Task<ActionResult<Page<Versioned<RegistrationRefundDto>>>> Refunds(Guid parishId, Guid eventId, Guid registrationId, CancellationToken ct,
        int size = 25, string? cursor = null)
    {
        var page = await service.RefundsAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), size, cursor, ct);
        return Ok(new Page<Versioned<RegistrationRefundDto>>
        {
            Items = page.Items.Select(row => new Versioned<RegistrationRefundDto> { Version = row.Version, Value = RegistrationService.ToDto(row.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        });
    }

    [HttpPost("registrations/{registrationId:guid}/refunds/{refundId:guid}/actions")]
    public async Task<ActionResult<RegistrationRefundDto>> RefundAction(Guid parishId, Guid eventId, Guid registrationId, Guid refundId,
        DecideEventRefundDto request, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.RefundActionAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), Guard.Id(refundId), request, ct)));

    [HttpPost("registrations/{registrationId:guid}/presence")]
    public async Task<ActionResult<PresenceChangeDto>> Presence(Guid parishId, Guid eventId, Guid registrationId, RecordPresenceDto request, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.PresenceAsync(Guard.Id(parishId), Guard.Id(eventId), Guard.Id(registrationId), request, ct)));

    [HttpGet("present")]
    public async Task<ActionResult<PresentRosterDto>> Present(Guid parishId, Guid eventId, CancellationToken ct)
        => Ok(RegistrationService.ToDto(await service.PresentAsync(Guard.Id(parishId), Guard.Id(eventId), ct)));
}
