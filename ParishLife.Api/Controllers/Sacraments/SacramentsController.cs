// Purpose: exposes sacramental cases, the register search, numbering policies and official corrections over HTTP.
// Main functions: Create, Act, Get, Search, SetPolicy, ProposeCorrection, DecideCorrection, PendingCorrections, Anniversaries and MyAnniversaries
// delegate rules to SacramentService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Sacraments;

namespace ParishLife.Api.Controllers.Sacraments;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/sacraments")]
public class SacramentsController(SacramentService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<SacramentRecordDto>> Create(Guid parishId, CreateSacramentDto request, CancellationToken ct)
        => Ok(await service.CreateAsync(Guard.Id(parishId), request, ct));

    [HttpPost("{recordId:guid}/actions")]
    public async Task<ActionResult<SacramentRecordDto>> Act(Guid parishId, Guid recordId, SacramentActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(recordId), request, ct));

    [HttpGet("{recordId:guid}")]
    public async Task<ActionResult<Versioned<SacramentRecordDto>>> Get(Guid parishId, Guid recordId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(recordId), ct));

    [HttpGet]
    public async Task<ActionResult<Page<Versioned<SacramentRecordDto>>>> Search(Guid parishId, string sacrament, CancellationToken ct, string? status = null,
        Guid? personId = null, int size = 25, string? cursor = null)
        => Ok(await service.SearchAsync(Guard.Id(parishId), sacrament, status, personId is { } p ? Guard.Id(p) : null, size, cursor, ct));

    [HttpPut("numbering")]
    public async Task<ActionResult<SacramentPolicyDto>> SetPolicy(Guid parishId, NumberingPolicyDto request, CancellationToken ct)
        => Ok(await service.SetPolicyAsync(Guard.Id(parishId), request, ct));

    [HttpPost("{recordId:guid}/corrections")]
    public async Task<ActionResult<SacramentCorrectionDto>> ProposeCorrection(Guid parishId, Guid recordId, ProposeCorrectionDto request, CancellationToken ct)
        => Ok(await service.ProposeCorrectionAsync(Guard.Id(parishId), Guard.Id(recordId), request, ct));

    [HttpPost("corrections/{correctionId:guid}/decision")]
    public async Task<ActionResult<SacramentCorrectionDto>> DecideCorrection(Guid parishId, Guid correctionId, DecideCorrectionDto request, CancellationToken ct)
        => Ok(await service.DecideCorrectionAsync(Guard.Id(parishId), Guard.Id(correctionId), request, ct));

    [HttpGet("anniversaries")]
    public async Task<ActionResult<IReadOnlyList<SacramentAnniversaryDto>>> Anniversaries(Guid parishId, DateOnly from, CancellationToken ct, int days = 30)
        => Ok(await service.AnniversariesAsync(Guard.Id(parishId), from, days, ct));

    [HttpGet("anniversaries/mine")]
    public async Task<ActionResult<IReadOnlyList<SacramentAnniversaryDto>>> MyAnniversaries(Guid parishId, CancellationToken ct)
        => Ok(await service.MyAnniversariesAsync(Guard.Id(parishId), ct));

    [HttpGet("corrections")]
    public async Task<ActionResult<IReadOnlyList<Versioned<SacramentCorrectionDto>>>> PendingCorrections(Guid parishId, CancellationToken ct)
        => Ok(await service.PendingCorrectionsAsync(Guard.Id(parishId), ct));
}
