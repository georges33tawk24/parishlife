// Purpose: exposes announcements and prayer intentions for staff, priests, members and the public over HTTP.
// Main functions: CreateAnnouncement, UpdateAnnouncement, AnnouncementAction, StaffAnnouncements, MemberAnnouncements, SubmitIntention,
// DecideIntention, OwnIntentions, PriestIntentions, PublicAnnouncements and PublicIntentions.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Controllers.Communications;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class CommunicationsController(CommunicationsService service) : ControllerBase
{
    [HttpPost("announcements")]
    public async Task<ActionResult<AnnouncementDto>> CreateAnnouncement(Guid parishId, SaveAnnouncementDto request, CancellationToken ct)
        => Ok(await service.SaveAnnouncementAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("announcements/{announcementId:guid}")]
    public async Task<ActionResult<AnnouncementDto>> UpdateAnnouncement(Guid parishId, Guid announcementId, SaveAnnouncementDto request, CancellationToken ct)
        => Ok(await service.SaveAnnouncementAsync(Guard.Id(parishId), Guard.Id(announcementId), request, ct));

    [HttpPost("announcements/{announcementId:guid}/actions")]
    public async Task<ActionResult<AnnouncementDto>> AnnouncementAction(Guid parishId, Guid announcementId, AnnouncementActionDto request, CancellationToken ct)
        => Ok(await service.AnnouncementActionAsync(Guard.Id(parishId), Guard.Id(announcementId), request, ct));

    [HttpGet("announcements")]
    public async Task<ActionResult<IReadOnlyList<Versioned<AnnouncementDto>>>> StaffAnnouncements(Guid parishId, CancellationToken ct)
        => Ok(await service.StaffAnnouncementsAsync(Guard.Id(parishId), ct));

    [HttpGet("announcements/mine")]
    public async Task<ActionResult<IReadOnlyList<AnnouncementDto>>> MemberAnnouncements(Guid parishId, CancellationToken ct)
        => Ok(await service.MemberAnnouncementsAsync(Guard.Id(parishId), ct));

    [HttpPost("prayer-intentions")]
    public async Task<ActionResult<PrayerIntentionDto>> SubmitIntention(Guid parishId, SubmitIntentionDto request, CancellationToken ct)
        => Ok(await service.SubmitIntentionAsync(Guard.Id(parishId), request, ct));

    [HttpPost("prayer-intentions/{intentionId:guid}/decision")]
    public async Task<ActionResult<PrayerIntentionDto>> DecideIntention(Guid parishId, Guid intentionId, IntentionDecisionDto request, CancellationToken ct)
        => Ok(await service.DecideIntentionAsync(Guard.Id(parishId), Guard.Id(intentionId), request, ct));

    [HttpGet("prayer-intentions/mine")]
    public async Task<ActionResult<IReadOnlyList<PrayerIntentionDto>>> OwnIntentions(Guid parishId, CancellationToken ct)
        => Ok(await service.OwnIntentionsAsync(Guard.Id(parishId), ct));

    [HttpGet("prayer-intentions")]
    public async Task<ActionResult<IReadOnlyList<Versioned<PrayerIntentionDto>>>> PriestIntentions(Guid parishId, CancellationToken ct)
        => Ok(await service.PriestIntentionsAsync(Guard.Id(parishId), ct));
}

[AllowAnonymous, ApiController, Route("api/public/parishes/{parishId:guid}")]
public class PublicCommunicationsController(CommunicationsService service) : ControllerBase
{
    [HttpGet("announcements")]
    public async Task<ActionResult<IReadOnlyList<AnnouncementDto>>> PublicAnnouncements(Guid parishId, CancellationToken ct)
        => Ok(await service.PublicAnnouncementsAsync(Guard.Id(parishId), ct));

    [HttpGet("prayer-intentions")]
    public async Task<ActionResult<IReadOnlyList<PrayerIntentionDto>>> PublicIntentions(Guid parishId, CancellationToken ct)
        => Ok(await service.PublicIntentionsAsync(Guard.Id(parishId), ct));
}
