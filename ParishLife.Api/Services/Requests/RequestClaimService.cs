// Purpose: lets a signed-in account list the guest requests it asked to link (A13) without reading the cases themselves.
// Main functions: RecordPointerAsync (account-partition pointer written before the parish claim commits) and ListAsync
// (resolves each pointer against the current case: Pending, Linked or NotPending; orphan or unreadable pointers are NotPending).

using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Requests;

public class RequestClaimService(IRecordTransactions records, IParishRepository parishes, MinistryAccess own, ICurrentActor actor, TimeProvider clock)
{
    internal const int MaximumListed = 200;
    private static RecordScope AccountScope(string account) => new() { Area = RecordArea.Account, OwnerId = account };
    private static string Key(string request) => "requestClaim:" + request;

    // Written in the claimant's own partition before the parish claim; it is not part of that transaction and carries no case contents.
    internal async Task RecordPointerAsync(string parish, ParishRequest item, CancellationToken ct)
    {
        var scope = AccountScope(actor.AccountId);
        var existing = await records.ReadAsync<RequestClaimPointer>(scope, Key(item.Id), ct);
        var pointer = new RequestClaimPointer
        {
            Id = item.Id, AccountId = actor.AccountId, ParishId = parish, RequestId = item.Id, Reference = item.Reference, ClaimedAt = clock.GetUtcNow()
        };
        var op = Operation.Create(Guid.NewGuid(), actor.AccountId, new { parish, item.Id }, clock, "request-claim-pointer:v1:" + item.Id);
        await records.CommitAsync(scope, op, "request.claim_pointer", item.Id,
            [existing is null ? RecordChange.Create(Key(item.Id), "requestClaimPointer", pointer) : RecordChange.Replace(Key(item.Id), "requestClaimPointer", pointer, existing.Version)],
            new CommandResult { Id = item.Id, Status = "Recorded" }, ct);
    }

    public async Task<IReadOnlyList<RequestClaimDto>> ListAsync(CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var pointers = await records.CollectAsync<RequestClaimPointer>(AccountScope(actor.AccountId), "requestClaimPointer", ct, MaximumListed);
        var result = new List<RequestClaimDto>();
        foreach (var pointer in pointers.Select(p => p.Value).Where(p => p.AccountId == actor.AccountId).OrderByDescending(p => p.ClaimedAt))
        {
            var parish = (await parishes.GetAsync(pointer.ParishId, ct))?.Value;
            var item = parish is null ? null : (await records.ReadAsync<ParishRequest>(new RecordScope { Area = RecordArea.Parish, OwnerId = pointer.ParishId }, "request:" + pointer.RequestId, ct))?.Value;
            var current = item is not null && item.Id == pointer.RequestId && item.ParishId == pointer.ParishId ? item : null;
            result.Add(new RequestClaimDto
            {
                ParishId = pointer.ParishId, ParishName = parish?.Status == ParishStatus.Verified ? parish.Name : "", RequestId = pointer.RequestId,
                Reference = pointer.Reference, ClaimedAt = pointer.ClaimedAt,
                State = current?.ApplicantAccountId == actor.AccountId ? "Linked" : current?.ClaimantAccountId == actor.AccountId ? "Pending" : "NotPending"
            });
        }
        return result;
    }
}
