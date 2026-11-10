// Purpose: exposes office-issued person invitations and the recipient's preview/accept over HTTP; the token travels in a header, never the URL.
// Main functions: Create, List, Revoke, Preview and Accept delegate rules to PersonInvitationService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class PersonInvitationsController(PersonInvitationService service) : ControllerBase
{
    private const string TokenHeader = "X-ParishLife-Invitation";

    [HttpPost("people/{personId:guid}/invitations")]
    public async Task<ActionResult<PersonInvitationIssuedDto>> Create(Guid parishId, Guid personId, CreatePersonInvitationDto request, CancellationToken ct)
        => Ok(await service.CreateAsync(Guard.Id(parishId), Guard.Id(personId), request, ct));

    [HttpGet("person-invitations")]
    public async Task<ActionResult<IReadOnlyList<Versioned<PersonInvitationDto>>>> List(Guid parishId, CancellationToken ct, Guid? personId = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), personId is { } p ? Guard.Id(p) : null, ct));

    [HttpPost("person-invitations/{invitationId:guid}/revoke")]
    public async Task<ActionResult<PersonInvitationDto>> Revoke(Guid parishId, Guid invitationId, RevokePersonInvitationDto request, CancellationToken ct)
        => Ok(await service.RevokeAsync(Guard.Id(parishId), Guard.Id(invitationId), request, ct));

    [HttpGet("person-invitations/{invitationId:guid}/preview")]
    public async Task<ActionResult<PersonInvitationPreviewDto>> Preview(Guid parishId, Guid invitationId, [FromHeader(Name = TokenHeader)] string? token, CancellationToken ct)
        => Ok(await service.PreviewAsync(Guard.Id(parishId), Guard.Id(invitationId), token, ct));

    [HttpPost("person-invitations/{invitationId:guid}/accept")]
    public async Task<ActionResult<PersonInvitationDto>> Accept(Guid parishId, Guid invitationId, [FromHeader(Name = TokenHeader)] string? token, CancellationToken ct)
        => Ok(await service.AcceptAsync(Guard.Id(parishId), Guard.Id(invitationId), token, ct));
}
