// Purpose: exposes parish following, primary-parish choice, membership requests and member profile corrections over HTTP.
// Main functions: Follow, Unfollow, Primary, MyParishes, Apply, MyRequests, Withdraw, Decide, Queue, ProposeCorrection,
// WithdrawCorrection, ReviewCorrection, MyCorrections, PendingCorrections and source-authorized notification outcome reads delegate rules to MembershipService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api")]
public class MembershipController(MembershipService service) : ControllerBase
{
    [HttpPost("parishes/{parishId:guid}/follow")]
    public async Task<ActionResult<IReadOnlyList<MyParishDto>>> Follow(Guid parishId, CancellationToken ct)
        => Ok(await service.FollowAsync(Guard.Id(parishId), ct));

    [HttpDelete("parishes/{parishId:guid}/follow")]
    public async Task<ActionResult<IReadOnlyList<MyParishDto>>> Unfollow(Guid parishId, CancellationToken ct)
        => Ok(await service.UnfollowAsync(Guard.Id(parishId), ct));

    [HttpPut("parishes/{parishId:guid}/primary")]
    public async Task<ActionResult<IReadOnlyList<MyParishDto>>> Primary(Guid parishId, CancellationToken ct)
        => Ok(await service.SetPrimaryAsync(Guard.Id(parishId), ct));

    [HttpGet("me/parishes")]
    public async Task<ActionResult<IReadOnlyList<MyParishDto>>> MyParishes(CancellationToken ct)
        => Ok(await service.MyParishesAsync(ct));

    [HttpPost("parishes/{parishId:guid}/membership-requests")]
    public async Task<ActionResult<MembershipRequestDto>> Apply(Guid parishId, RequestMembershipDto request, CancellationToken ct)
        => Ok(await service.RequestAsync(Guard.Id(parishId), request, ct));

    [HttpGet("parishes/{parishId:guid}/membership-requests/mine")]
    public async Task<ActionResult<IReadOnlyList<MembershipRequestDto>>> MyRequests(Guid parishId, CancellationToken ct)
        => Ok(await service.OwnRequestsAsync(Guard.Id(parishId), ct));

    [HttpPost("parishes/{parishId:guid}/membership-requests/{requestId:guid}/withdraw")]
    public async Task<ActionResult<MembershipRequestDto>> Withdraw(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.WithdrawRequestAsync(Guard.Id(parishId), Guard.Id(requestId), ct));

    [HttpPost("parishes/{parishId:guid}/membership-requests/{requestId:guid}/decision")]
    public async Task<ActionResult<MembershipRequestDto>> Decide(Guid parishId, Guid requestId, MembershipDecisionDto request, CancellationToken ct)
        => Ok(await service.DecideAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));

    [HttpGet("parishes/{parishId:guid}/membership-requests")]
    public async Task<ActionResult<IReadOnlyList<Versioned<MembershipRequestDto>>>> Queue(Guid parishId, CancellationToken ct)
        => Ok(await service.QueueAsync(Guard.Id(parishId), ct));

    [HttpGet("parishes/{parishId:guid}/membership-requests/{requestId:guid}/notification-outcome")]
    public async Task<ActionResult<NotificationOutcomeDto>> MembershipNotificationOutcome(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.MembershipNotificationOutcomeAsync(Guard.Id(parishId), Guard.Id(requestId), ct));

    [HttpPost("parishes/{parishId:guid}/profile-corrections")]
    public async Task<ActionResult<ProfileCorrectionDto>> ProposeCorrection(Guid parishId, ProposeProfileCorrectionDto request, CancellationToken ct)
        => Ok(await service.ProposeCorrectionAsync(Guard.Id(parishId), request, ct));

    [HttpPost("parishes/{parishId:guid}/profile-corrections/{correctionId:guid}/withdraw")]
    public async Task<ActionResult<ProfileCorrectionDto>> WithdrawCorrection(Guid parishId, Guid correctionId, CancellationToken ct)
        => Ok(await service.WithdrawCorrectionAsync(Guard.Id(parishId), Guard.Id(correctionId), ct));

    [HttpPost("parishes/{parishId:guid}/profile-corrections/{correctionId:guid}/review")]
    public async Task<ActionResult<ProfileCorrectionDto>> ReviewCorrection(Guid parishId, Guid correctionId, ReviewProfileCorrectionDto request, CancellationToken ct)
        => Ok(await service.ReviewCorrectionAsync(Guard.Id(parishId), Guard.Id(correctionId), request, ct));

    [HttpGet("parishes/{parishId:guid}/profile-corrections/mine")]
    public async Task<ActionResult<IReadOnlyList<Versioned<ProfileCorrectionDto>>>> MyCorrections(Guid parishId, CancellationToken ct)
        => Ok(await service.CorrectionsAsync(Guard.Id(parishId), true, ct));

    [HttpGet("parishes/{parishId:guid}/profile-corrections")]
    public async Task<ActionResult<IReadOnlyList<Versioned<ProfileCorrectionDto>>>> PendingCorrections(Guid parishId, CancellationToken ct)
        => Ok(await service.CorrectionsAsync(Guard.Id(parishId), false, ct));

    [HttpGet("parishes/{parishId:guid}/profile-corrections/{correctionId:guid}/notification-outcome")]
    public async Task<ActionResult<NotificationOutcomeDto>> CorrectionNotificationOutcome(Guid parishId, Guid correctionId, CancellationToken ct)
        => Ok(await service.CorrectionNotificationOutcomeAsync(Guard.Id(parishId), Guard.Id(correctionId), ct));
}
