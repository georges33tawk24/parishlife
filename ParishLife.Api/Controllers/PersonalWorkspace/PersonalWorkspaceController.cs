// Purpose: exposes only the authenticated account's My notes/personal tasks with bounded reads and conditional commands.
// Main functions: List, Get, Create, Save, Act and History; no account selector, organizational fallback or sharing endpoints exist.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Models;
using ParishLife.Api.Services.PersonalWorkspace;

namespace ParishLife.Api.Controllers.PersonalWorkspace;

[Authorize, ApiController, Route("api/me/personal-workspace")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class PersonalWorkspaceController(PersonalWorkspaceService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Page<Versioned<PersonalItemDto>>>> List(CancellationToken ct, int size = 25, string? cursor = null, string? kind = null, string? status = null)
        => Ok(await service.ListAsync(size, cursor, kind, status, ct));
    [HttpGet("{itemId:guid}")]
    public async Task<ActionResult<Versioned<PersonalItemDto>>> Get(Guid itemId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(itemId), ct));
    [HttpPost]
    public async Task<ActionResult<Versioned<PersonalItemDto>>> Create(SavePersonalItemDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(null, request, ct));
    [HttpPut("{itemId:guid}")]
    public async Task<ActionResult<Versioned<PersonalItemDto>>> Save(Guid itemId, SavePersonalItemDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(itemId), request, ct));
    [HttpPost("{itemId:guid}/actions")]
    public async Task<ActionResult<Versioned<PersonalItemDto>>> Act(Guid itemId, PersonalItemActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(itemId), request, ct));
    [HttpGet("{itemId:guid}/history")]
    public async Task<ActionResult<Page<PersonalItemRevisionDto>>> History(Guid itemId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(itemId), size, cursor, ct));
}
