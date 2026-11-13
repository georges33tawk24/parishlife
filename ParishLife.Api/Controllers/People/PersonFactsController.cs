// Purpose: exposes optional person facts, designated-staff medical declarations and consents (office and own) over HTTP.
// Main functions: SaveFacts, Facts, FactsList, SaveMedical, Medical, RecordConsent, Consents, ParishConsents, WithdrawConsent, RecordOwnConsent, OwnConsents and
// WithdrawOwnConsent delegate rules to PersonFactsService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class PersonFactsController(PersonFactsService service) : ControllerBase
{
    [HttpPut("people/{personId:guid}/facts")]
    public async Task<ActionResult<PersonFactsDto>> SaveFacts(Guid parishId, Guid personId, SavePersonFactsDto request, CancellationToken ct)
        => Ok(await service.SaveFactsAsync(Guard.Id(parishId), Guard.Id(personId), request, ct));

    [HttpGet("people/{personId:guid}/facts")]
    public async Task<ActionResult<Versioned<PersonFactsDto>>> Facts(Guid parishId, Guid personId, CancellationToken ct)
        => Ok(await service.GetFactsAsync(Guard.Id(parishId), Guard.Id(personId), ct));

    [HttpGet("people/facts")]
    public async Task<ActionResult<Page<Versioned<PersonFactsDto>>>> FactsList(Guid parishId, CancellationToken ct, int size = 100, string? cursor = null)
        => Ok(await service.ListFactsAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpPut("people/{personId:guid}/medical")]
    public async Task<ActionResult<MedicalDto>> SaveMedical(Guid parishId, Guid personId, SaveMedicalDto request, CancellationToken ct)
        => Ok(await service.SaveMedicalAsync(Guard.Id(parishId), Guard.Id(personId), request, ct));

    [HttpGet("people/{personId:guid}/medical")]
    public async Task<ActionResult<Versioned<MedicalDto>>> Medical(Guid parishId, Guid personId, CancellationToken ct)
        => Ok(await service.GetMedicalAsync(Guard.Id(parishId), Guard.Id(personId), ct));

    [HttpPost("people/{personId:guid}/consents")]
    public async Task<ActionResult<ConsentDto>> RecordConsent(Guid parishId, Guid personId, RecordConsentDto request, CancellationToken ct)
        => Ok(await service.RecordConsentAsync(Guard.Id(parishId), Guard.Id(personId), request, ct));

    [HttpGet("people/{personId:guid}/consents")]
    public async Task<ActionResult<IReadOnlyList<Versioned<ConsentDto>>>> Consents(Guid parishId, Guid personId, CancellationToken ct)
        => Ok(await service.ConsentsAsync(Guard.Id(parishId), Guard.Id(personId), ct));

    [HttpGet("consents")]
    public async Task<ActionResult<Page<Versioned<ConsentDto>>>> ParishConsents(Guid parishId, string kind, CancellationToken ct, bool includeWithdrawn = false, int size = 100, string? cursor = null)
        => Ok(await service.ParishConsentsAsync(Guard.Id(parishId), kind, includeWithdrawn, size, cursor, ct));

    [HttpPost("consents/{consentId:guid}/withdraw")]
    public async Task<ActionResult<ConsentDto>> WithdrawConsent(Guid parishId, Guid consentId, WithdrawConsentDto request, CancellationToken ct)
        => Ok(await service.WithdrawConsentAsync(Guard.Id(parishId), Guard.Id(consentId), request, ct));

    [HttpPost("me/consents")]
    public async Task<ActionResult<ConsentDto>> RecordOwnConsent(Guid parishId, RecordConsentDto request, CancellationToken ct)
        => Ok(await service.RecordOwnConsentAsync(Guard.Id(parishId), request, ct));

    [HttpGet("me/consents")]
    public async Task<ActionResult<IReadOnlyList<Versioned<ConsentDto>>>> OwnConsents(Guid parishId, CancellationToken ct)
        => Ok(await service.OwnConsentsAsync(Guard.Id(parishId), ct));

    [HttpPost("me/consents/{consentId:guid}/withdraw")]
    public async Task<ActionResult<ConsentDto>> WithdrawOwnConsent(Guid parishId, Guid consentId, WithdrawConsentDto request, CancellationToken ct)
        => Ok(await service.WithdrawOwnConsentAsync(Guard.Id(parishId), Guard.Id(consentId), request, ct));
}
