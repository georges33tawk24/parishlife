// Purpose: exposes parish equipment, equipment bookings and facility issue reporting/repair over HTTP.
// Main functions: CreateEquipment, UpdateEquipment, ListEquipment, Book, BookingAction, Bookings, ReportIssue, IssueAction, GetIssue and ListIssues.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class EquipmentController(EquipmentService equipment, FacilityIssueService issues) : ControllerBase
{
    [HttpPost("equipment")]
    public async Task<ActionResult<EquipmentDto>> CreateEquipment(Guid parishId, SaveEquipmentDto request, CancellationToken ct)
        => Ok(await equipment.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("equipment/{equipmentId:guid}")]
    public async Task<ActionResult<EquipmentDto>> UpdateEquipment(Guid parishId, Guid equipmentId, SaveEquipmentDto request, CancellationToken ct)
        => Ok(await equipment.SaveAsync(Guard.Id(parishId), Guard.Id(equipmentId), request, ct));

    [HttpGet("equipment")]
    public async Task<ActionResult<Page<Versioned<EquipmentDto>>>> ListEquipment(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await equipment.ListAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpPost("equipment/{equipmentId:guid}/bookings")]
    public async Task<ActionResult<EquipmentBookingDto>> Book(Guid parishId, Guid equipmentId, BookEquipmentDto request, CancellationToken ct)
        => Ok(await equipment.BookAsync(Guard.Id(parishId), Guard.Id(equipmentId), request, ct));

    [HttpGet("equipment/{equipmentId:guid}/bookings")]
    public async Task<ActionResult<Page<Versioned<EquipmentBookingDto>>>> Bookings(Guid parishId, Guid equipmentId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await equipment.BookingsAsync(Guard.Id(parishId), Guard.Id(equipmentId), size, cursor, ct));

    [HttpPost("equipment-bookings/{bookingId:guid}/actions")]
    public async Task<ActionResult<EquipmentBookingDto>> BookingAction(Guid parishId, Guid bookingId, EquipmentBookingActionDto request, CancellationToken ct)
        => Ok(await equipment.ActAsync(Guard.Id(parishId), Guard.Id(bookingId), request, ct));

    [HttpPost("facility-issues")]
    public async Task<ActionResult<FacilityIssueDto>> ReportIssue(Guid parishId, ReportIssueDto request, CancellationToken ct)
        => Ok(await issues.ReportAsync(Guard.Id(parishId), request, ct));

    [HttpPost("facility-issues/{issueId:guid}/actions")]
    public async Task<ActionResult<FacilityIssueDto>> IssueAction(Guid parishId, Guid issueId, IssueActionDto request, CancellationToken ct)
        => Ok(await issues.ActAsync(Guard.Id(parishId), Guard.Id(issueId), request, ct));

    [HttpGet("facility-issues/{issueId:guid}")]
    public async Task<ActionResult<Versioned<FacilityIssueDto>>> GetIssue(Guid parishId, Guid issueId, CancellationToken ct)
        => Ok(await issues.GetAsync(Guard.Id(parishId), Guard.Id(issueId), ct));

    [HttpGet("facility-issues")]
    public async Task<ActionResult<Page<Versioned<FacilityIssueDto>>>> ListIssues(Guid parishId, CancellationToken ct, string? status = null, int size = 25, string? cursor = null)
        => Ok(await issues.ListAsync(Guard.Id(parishId), status, size, cursor, ct));
}
