// Purpose: exposes accepted parish-priest appointments and explicit head-priest designation periods.
// Main functions: Scope, Invite, List, Get, Respond, Act, Workspace, DesignateHead, EndHead enforce the exact archdiocese/parish scope through the service.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize, ApiController, Route("api/archdioceses/{archdioceseId:guid}/parishes/{parishId:guid}/priest-appointments")]
public class ParishPriestAppointmentsController(StaffAppointmentService service) : ControllerBase
{
    [HttpGet("scope")]
    public async Task<ActionResult<Versioned<AppointmentScopeDto>>> Scope(Guid archdioceseId, Guid parishId, CancellationToken ct)
        => Ok(await service.ScopeAsync(Guard.Id(archdioceseId), Guard.Id(parishId), ct));

    [HttpPost]
    public async Task<ActionResult<StaffAppointmentDto>> Invite(Guid archdioceseId, Guid parishId, InviteStaffAppointmentDto request, CancellationToken ct)
        => Ok(await service.InviteAsync(Guard.Id(archdioceseId), Guard.Id(parishId), request, ct));

    [HttpGet]
    public async Task<ActionResult<Page<Versioned<StaffAppointmentDto>>>> List(Guid archdioceseId, Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(archdioceseId), Guard.Id(parishId), size, cursor, ct));

    [HttpGet("{appointmentId:guid}")]
    public async Task<ActionResult<Versioned<StaffAppointmentDto>>> Get(Guid archdioceseId, Guid parishId, Guid appointmentId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(archdioceseId), Guard.Id(parishId), Guard.Id(appointmentId), ct));

    [HttpPost("{appointmentId:guid}/response")]
    public async Task<ActionResult<StaffAppointmentDto>> Respond(Guid archdioceseId, Guid parishId, Guid appointmentId, DecideStaffAppointmentDto request, CancellationToken ct)
        => Ok(await service.DecideAsync(Guard.Id(archdioceseId), Guard.Id(parishId), Guard.Id(appointmentId), request, ct));

    [HttpPost("{appointmentId:guid}/actions")]
    public async Task<ActionResult<StaffAppointmentDto>> Act(Guid archdioceseId, Guid parishId, Guid appointmentId, ActStaffAppointmentDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(archdioceseId), Guard.Id(parishId), Guard.Id(appointmentId), request, ct));

    [HttpGet("{appointmentId:guid}/workspace")]
    public async Task<ActionResult<AppointmentWorkspaceDto>> Workspace(Guid archdioceseId, Guid parishId, Guid appointmentId, CancellationToken ct)
        => Ok(await service.WorkspaceAsync(Guard.Id(archdioceseId), Guard.Id(parishId), Guard.Id(appointmentId), ct));

    [HttpPut("{appointmentId:guid}/head-designation")]
    public async Task<ActionResult<StaffAppointmentDto>> DesignateHead(Guid archdioceseId, Guid parishId, Guid appointmentId, DesignateHeadPriestDto request, CancellationToken ct)
        => Ok(await service.DesignateHeadAsync(Guard.Id(archdioceseId), Guard.Id(parishId), Guard.Id(appointmentId), request, ct));

    [HttpPost("{appointmentId:guid}/head-designation/end")]
    public async Task<ActionResult<StaffAppointmentDto>> EndHead(Guid archdioceseId, Guid parishId, Guid appointmentId, EndHeadPriestDto request, CancellationToken ct)
        => Ok(await service.EndHeadAsync(Guard.Id(archdioceseId), Guard.Id(parishId), Guard.Id(appointmentId), request, ct));
}
