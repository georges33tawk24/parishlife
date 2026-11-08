// Purpose: exposes bishop-authorized Archdiocese Admin invitations and their bounded duty workspaces.
// Main functions: Scope, Invite, List, Get, Respond, Act, Workspace delegate workflow and access checks to StaffAppointmentService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize, ApiController, Route("api/archdioceses/{archdioceseId:guid}/staff-appointments")]
public class ArchdioceseStaffAppointmentsController(StaffAppointmentService service) : ControllerBase
{
    [HttpGet("scope")]
    public async Task<ActionResult<Versioned<AppointmentScopeDto>>> Scope(Guid archdioceseId, CancellationToken ct)
        => Ok(await service.ScopeAsync(Guard.Id(archdioceseId), null, ct));

    [HttpPost]
    public async Task<ActionResult<StaffAppointmentDto>> Invite(Guid archdioceseId, InviteStaffAppointmentDto request, CancellationToken ct)
        => Ok(await service.InviteAsync(Guard.Id(archdioceseId), null, request, ct));

    [HttpGet]
    public async Task<ActionResult<Page<Versioned<StaffAppointmentDto>>>> List(Guid archdioceseId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(archdioceseId), null, size, cursor, ct));

    [HttpGet("{appointmentId:guid}")]
    public async Task<ActionResult<Versioned<StaffAppointmentDto>>> Get(Guid archdioceseId, Guid appointmentId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(archdioceseId), null, Guard.Id(appointmentId), ct));

    [HttpPost("{appointmentId:guid}/response")]
    public async Task<ActionResult<StaffAppointmentDto>> Respond(Guid archdioceseId, Guid appointmentId, DecideStaffAppointmentDto request, CancellationToken ct)
        => Ok(await service.DecideAsync(Guard.Id(archdioceseId), null, Guard.Id(appointmentId), request, ct));

    [HttpPost("{appointmentId:guid}/actions")]
    public async Task<ActionResult<StaffAppointmentDto>> Act(Guid archdioceseId, Guid appointmentId, ActStaffAppointmentDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(archdioceseId), null, Guard.Id(appointmentId), request, ct));

    [HttpGet("{appointmentId:guid}/workspace")]
    public async Task<ActionResult<AppointmentWorkspaceDto>> Workspace(Guid archdioceseId, Guid appointmentId, CancellationToken ct)
        => Ok(await service.WorkspaceAsync(Guard.Id(archdioceseId), null, Guard.Id(appointmentId), ct));
}
