// Purpose: HTTP endpoints for people workflows; delegates work to backend services.
// Main functions: Create, List, Get, Update (office edit of the core record), Archive.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/people")]
public sealed class PeopleController(PeopleService service) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(Guid parishId, CreatePersonDto request, CancellationToken ct) => Ok(PersonDto.From(await service.CreateAsync(Guard.Id(parishId), request, ct)));
    [HttpGet]
    public async Task<IActionResult> List(Guid parishId, CancellationToken ct, int pageSize = 50, string? continuation = null)
    {
        var page = await service.ListAsync(Guard.Id(parishId), pageSize, continuation, ct);
        return Ok(new Page<PersonDto> { Items = page.Items.Select(PersonDto.From).ToArray(), ContinuationToken = page.ContinuationToken });
    }

    [HttpGet("{personId:guid}")]
    public async Task<IActionResult> Get(Guid parishId, Guid personId, CancellationToken ct)
    {
        var row = await service.GetAsync(Guard.Id(parishId), Guard.Id(personId), ct);
        return Ok(new Versioned<PersonDto> { Value = PersonDto.From(row.Value), Version = row.Version });
    }

    [HttpPut("{personId:guid}")]
    public async Task<IActionResult> Update(Guid parishId, Guid personId, UpdatePersonDto request, CancellationToken ct)
    {
        var row = await service.UpdateAsync(Guard.Id(parishId), Guard.Id(personId), request, ct);
        return Ok(new Versioned<PersonDto> { Value = PersonDto.From(row.Value), Version = row.Version });
    }

    [HttpPost("{personId:guid}/archive")]
    public async Task<IActionResult> Archive(Guid parishId, Guid personId, ArchivePersonDto request, CancellationToken ct) => Ok(PersonDto.From(await service.SetArchiveAsync(Guard.Id(parishId), Guard.Id(personId), request, ct)));
}
