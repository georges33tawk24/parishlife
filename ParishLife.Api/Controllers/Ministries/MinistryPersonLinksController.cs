// Purpose: exposes reviewed identity matching and the authenticated person's own link without matching evidence.
// Main functions: Link, Mine, Get and ByPerson use the person-link service and current permissions.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/person-account-links")]
public class MinistryPersonLinksController(MinistryPersonLinkService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PersonAccountLinkDto>> Link(Guid parishId, LinkMinistryPersonDto request, CancellationToken ct)
        => Ok(await service.LinkAsync(Guard.Id(parishId), request, ct));
    [HttpGet("mine")]
    public async Task<ActionResult<Versioned<PersonAccountLinkDto>>> Mine(Guid parishId, CancellationToken ct)
        => Ok(await service.GetOwnAsync(Guard.Id(parishId), ct));
    [HttpGet("by-person/{personId:guid}")]
    public async Task<ActionResult<Versioned<PersonAccountLinkDto>>> ByPerson(Guid parishId, Guid personId, CancellationToken ct)
        => Ok(await service.GetByPersonAsync(Guard.Id(parishId), Guard.Id(personId), ct));
    [HttpGet("{accountId:guid}")]
    public async Task<ActionResult<Versioned<PersonAccountLinkDto>>> Get(Guid parishId, Guid accountId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(accountId), ct));
}
