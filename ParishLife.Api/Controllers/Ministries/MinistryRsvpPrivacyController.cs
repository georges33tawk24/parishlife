// Purpose: exposes own private RSVP-reason set/clear/read and separately authorized designated-reader point access.
// Main functions: Save and Mine bind the authenticated personal author; Get requires the service's exact private-reason reader permission.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}/meetings/{meetingId:guid}/rsvp-private-reason")]
public class MinistryRsvpPrivacyController(MinistryRsvpPrivacyService service) : ControllerBase
{
    [HttpPut]
    public async Task<ActionResult<PrivateRsvpReasonDto>> Save(Guid parishId, Guid ministryId, Guid meetingId, SaveRsvpReasonDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), request, ct));

    [HttpGet]
    public async Task<ActionResult<Versioned<PrivateRsvpReasonDto>>> Mine(Guid parishId, Guid ministryId, Guid meetingId, CancellationToken ct)
        => Ok(await service.GetOwnAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), ct));

    [HttpGet("{personId:guid}")]
    public async Task<ActionResult<Versioned<PrivateRsvpReasonDto>>> Get(Guid parishId, Guid ministryId, Guid meetingId, Guid personId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(meetingId), Guard.Id(personId), ct));
}
