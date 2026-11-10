// Purpose: exposes private manual parish CRM/follow-up for current personal MFA platform operators; no automated outreach or public directory is provided.
// Main functions: Get, Save, Note, Entry, History and Due delegate exact scope, concurrency and permission rules to ParishCrmService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Administration;

namespace ParishLife.Api.Controllers.Administration;

[Authorize, ApiController, Route("api/administration/parishes/{parishId:guid}/crm")]
public class ParishCrmController(ParishCrmService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Versioned<ParishCrmDto>>> Get(Guid parishId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), ct));

    [HttpPut]
    public async Task<ActionResult<ParishCrmEntryDto>> Save(Guid parishId, ParishCrmSaveDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), request, ct));

    [HttpPost("notes")]
    public async Task<ActionResult<ParishCrmEntryDto>> Note(Guid parishId, ParishCrmNoteDto request, CancellationToken ct)
        => Ok(await service.AddNoteAsync(Guard.Id(parishId), request, ct));

    [HttpGet("history/{entryId:guid}")]
    public async Task<ActionResult<ParishCrmEntryDto>> Entry(Guid parishId, Guid entryId, CancellationToken ct)
        => Ok(await service.EntryAsync(Guard.Id(parishId), Guard.Id(entryId), ct));

    [HttpGet("history")]
    public async Task<ActionResult<Page<ParishCrmEntryDto>>> History(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpGet("due-follow-up")]
    public async Task<ActionResult<Versioned<ParishCrmDto>?>> Due(Guid parishId, CancellationToken ct)
        => Ok(await service.DueAsync(Guard.Id(parishId), ct));
}
