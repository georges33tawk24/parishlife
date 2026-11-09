// Purpose: exposes typed actual-meeting attendance snapshot, entry, review and own-record endpoints under current scoped duties.
// Main functions: Open, Snapshot, Get, Grid, Guest, Record, Close, Correct, Mine and History delegate source/privacy/conditional-write rules to MinistryAttendanceService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}/meetings/{meetingId:guid}/attendance")]
public class MinistryAttendanceController(MinistryAttendanceService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<Versioned<AttendanceSheetDto>>> Open(Guid parishId, Guid ministryId, Guid meetingId, AttendanceOpenDto request, CancellationToken ct)
    {
        var result = await service.OpenAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct);
        return result.Value.SnapshotComplete ? Ok(result) : StatusCode(StatusCodes.Status202Accepted, result);
    }
    [HttpPost("snapshot")]
    public async Task<ActionResult<Versioned<AttendanceSheetDto>>> Snapshot(Guid parishId, Guid ministryId, Guid meetingId, AttendanceSnapshotDto request, CancellationToken ct)
    {
        var result = await service.AdvanceSnapshotAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct);
        return result.Value.SnapshotComplete ? Ok(result) : StatusCode(StatusCodes.Status202Accepted, result);
    }
    [HttpGet]
    public async Task<ActionResult<Versioned<AttendanceSheetDto>>> Get(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), ct));
    [HttpGet("rows")]
    public async Task<ActionResult<AttendanceRowsDto>> Grid(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.GridAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), size, cursor, ct));
    [HttpPost("records")]
    public async Task<ActionResult<Versioned<AttendanceSheetDto>>> Record(Guid parishId, Guid ministryId, Guid meetingId, AttendanceWriteDto request, CancellationToken ct)
        => Ok(await service.RecordAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct));
    [HttpPost("guests")]
    public async Task<ActionResult<Versioned<AttendanceSheetDto>>> Guest(Guid parishId, Guid ministryId, Guid meetingId, AttendanceGuestDto request, CancellationToken ct)
        => Ok(await service.AddGuestAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct));
    [HttpPost("close")]
    public async Task<ActionResult<Versioned<AttendanceSheetDto>>> Close(Guid parishId, Guid ministryId, Guid meetingId, AttendanceCloseDto request, CancellationToken ct)
        => Ok(await service.CloseAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct));
    [HttpPost("corrections")]
    public async Task<ActionResult<Versioned<AttendanceSheetDto>>> Correct(Guid parishId, Guid ministryId, Guid meetingId, AttendanceCorrectDto request, CancellationToken ct)
        => Ok(await service.CorrectAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct));
    [HttpGet("mine")]
    public async Task<ActionResult<AttendanceValueDto>> Mine(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct)
        => Ok(await service.OwnAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), ct));
    [HttpGet("history")]
    public async Task<ActionResult<Page<AttendanceChangeDto>>> History(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), size, cursor, ct));
}
