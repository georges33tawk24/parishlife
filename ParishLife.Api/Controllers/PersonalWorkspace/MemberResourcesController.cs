// Purpose: exposes the member portal's own reads that span the member's ministries and notification topics.
// Main functions: Resources (GET api/parishes/{parishId}/me/ministry-resources) and NotificationTopics (GET api/me/notification-topics).

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Models;
using ParishLife.Api.Services.PersonalWorkspace;

namespace ParishLife.Api.Controllers.PersonalWorkspace;

[Authorize, ApiController]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class MemberResourcesController(MemberMinistryResourceService resources, NotificationTopicCatalog topics) : ControllerBase
{
    [HttpGet("api/parishes/{parishId:guid}/me/ministry-resources")]
    public async Task<ActionResult<MemberMinistryResourcesDto>> Resources(Guid parishId, CancellationToken ct)
        => Ok(await resources.ListAsync(Guard.Id(parishId), ct));

    [HttpGet("api/me/notification-topics")]
    public ActionResult<NotificationTopicDto[]> NotificationTopics() => Ok(topics.List());
}
