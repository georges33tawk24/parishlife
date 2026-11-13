// Purpose: exposes service plans/templates, their review actions and audience outputs, and the parish music library over HTTP.
// Main functions: Create, Update, Act, Get, List, Celebrants, Output, PublishMusic, WithdrawMusic, GetMusic and SearchMusic delegate rules to the services.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class ServicePlansController(ServicePlanService plans, MusicLibraryService music) : ControllerBase
{
    [HttpPost("plans")]
    public async Task<ActionResult<ServicePlanDto>> Create(Guid parishId, SavePlanDto request, CancellationToken ct)
        => Ok(await plans.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("plans/{planId:guid}")]
    public async Task<ActionResult<ServicePlanDto>> Update(Guid parishId, Guid planId, SavePlanDto request, CancellationToken ct)
        => Ok(await plans.SaveAsync(Guard.Id(parishId), Guard.Id(planId), request, ct));

    [HttpPost("plans/{planId:guid}/actions")]
    public async Task<ActionResult<ServicePlanDto>> Act(Guid parishId, Guid planId, PlanActionDto request, CancellationToken ct)
        => Ok(await plans.ActAsync(Guard.Id(parishId), Guard.Id(planId), request, ct));

    [HttpGet("plans/{planId:guid}")]
    public async Task<ActionResult<Versioned<ServicePlanDto>>> Get(Guid parishId, Guid planId, CancellationToken ct)
        => Ok(await plans.GetAsync(Guard.Id(parishId), Guard.Id(planId), ct));

    // Without an event this lists templates; with one it lists that event's plans.
    [HttpGet("plans")]
    public async Task<ActionResult<Page<Versioned<ServicePlanDto>>>> List(Guid parishId, CancellationToken ct, Guid? eventId = null, int size = 25, string? cursor = null)
        => Ok(await plans.ListAsync(Guard.Id(parishId), eventId is { } id ? Guard.Id(id) : null, size, cursor, ct));

    // The current priests who may be chosen as a Liturgy's celebrant.
    [HttpGet("plans/celebrants")]
    public async Task<ActionResult<IReadOnlyList<PlanCelebrantDto>>> Celebrants(Guid parishId, CancellationToken ct)
        => Ok(await plans.CelebrantsAsync(Guard.Id(parishId), ct));

    [HttpGet("plans/{planId:guid}/outputs/{audience}")]
    public async Task<ActionResult<PlanOutputDto>> Output(Guid parishId, Guid planId, string audience, CancellationToken ct)
        => Ok(await plans.OutputAsync(Guard.Id(parishId), Guard.Id(planId), audience, ct));

    [HttpPost("music")]
    public async Task<ActionResult<MusicVersionDto>> PublishMusic(Guid parishId, PublishMusicDto request, CancellationToken ct)
        => Ok(await music.PublishAsync(Guard.Id(parishId), request, ct));

    [HttpPost("music/{musicId:guid}/withdraw")]
    public async Task<ActionResult<MusicVersionDto>> WithdrawMusic(Guid parishId, Guid musicId, WithdrawMusicDto request, CancellationToken ct)
        => Ok(await music.WithdrawAsync(Guard.Id(parishId), Guard.Id(musicId), request, ct));

    [HttpGet("music/{musicId:guid}")]
    public async Task<ActionResult<Versioned<MusicVersionDto>>> GetMusic(Guid parishId, Guid musicId, CancellationToken ct)
        => Ok(await music.GetAsync(Guard.Id(parishId), Guard.Id(musicId), ct));

    [HttpGet("music")]
    public async Task<ActionResult<Page<MusicVersionDto>>> SearchMusic(Guid parishId, CancellationToken ct, string? text = null, string? language = null,
        string? season = null, string? rite = null, bool includeInactive = false, int size = 25, int offset = 0)
        => Ok(await music.SearchAsync(Guard.Id(parishId), text, language, season, rite, includeInactive, size, offset, ct));
}
