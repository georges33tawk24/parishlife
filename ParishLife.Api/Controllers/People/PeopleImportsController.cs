// Purpose: exposes staged, reviewed CSV people imports over HTTP.
// Main functions: Stage, Get and Commit delegate rules to PeopleImportService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/people/imports")]
public class PeopleImportsController(PeopleImportService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PeopleImportDto>> Stage(Guid parishId, StagePeopleImportDto request, CancellationToken ct)
        => Ok(await service.StageAsync(Guard.Id(parishId), request, ct));

    [HttpGet("{importId:guid}")]
    public async Task<ActionResult<PeopleImportDto>> Get(Guid parishId, Guid importId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(importId), ct));

    [HttpPost("{importId:guid}/commit")]
    public async Task<ActionResult<PeopleImportDto>> Commit(Guid parishId, Guid importId, CommitPeopleImportDto request, CancellationToken ct)
        => Ok(await service.CommitAsync(Guard.Id(parishId), Guard.Id(importId), request, ct));
}
