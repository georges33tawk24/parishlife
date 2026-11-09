// Purpose: exposes typed group meeting and personal planning-reply endpoints without exposing the stored calendar/source documents.
// Main functions: Create, Update, Get, List, Act, Reply, OwnReply, Replies and History delegate authorization and atomic changes to MinistryMeetingService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}/meetings")]
public class MinistryMeetingsController(MinistryMeetingService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<MinistryMeetingDto>> Create(Guid parishId, Guid ministryId, SaveMinistryMeetingDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(ministryId), null, request, ct));

    [HttpPut("{meetingId:guid}")]
    public async Task<ActionResult<MinistryMeetingDto>> Update(Guid parishId, Guid ministryId, Guid meetingId, SaveMinistryMeetingDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct));

    [HttpGet("{meetingId:guid}")]
    public async Task<ActionResult<Versioned<MinistryMeetingDto>>> Get(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), ct));

    [HttpGet]
    public async Task<ActionResult<Page<MinistryMeetingDto>>> List(Guid parishId, Guid ministryId, DateTimeOffset start, DateTimeOffset end,
        CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), Guard.Id(ministryId), start, end, size, cursor, ct));

    [HttpPost("{meetingId:guid}/actions")]
    public async Task<ActionResult<MinistryMeetingDto>> Act(Guid parishId, Guid ministryId, Guid meetingId, MinistryMeetingActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct));

    [HttpPut("{meetingId:guid}/rsvp")]
    public async Task<ActionResult<MeetingRsvpDto>> Reply(Guid parishId, Guid ministryId, Guid meetingId, RsvpDto request, CancellationToken ct)
        => Ok(await service.RsvpAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct));

    [HttpGet("{meetingId:guid}/rsvp")]
    public async Task<ActionResult<Versioned<MeetingRsvpDto>>> OwnReply(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct)
        => Ok(await service.OwnRsvpAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), ct));

    [HttpGet("{meetingId:guid}/rsvps")]
    public async Task<ActionResult<Page<MeetingRsvpDto>>> Replies(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.RsvpsAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), size, cursor, ct));

    [HttpGet("{meetingId:guid}/history")]
    public async Task<ActionResult<Page<MinistryMeetingHistoryDto>>> History(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), size, cursor, ct));
}
