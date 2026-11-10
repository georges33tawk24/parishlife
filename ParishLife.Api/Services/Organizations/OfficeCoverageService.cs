// Purpose: shows the parish owner who holds office duties through direct grants (any number, including none) and each holder's open
// requests and incidents, so a departing secretary's work can be handed over before access is revoked.
// Main function: CoverageAsync.

using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Requests;

namespace ParishLife.Api.Services.Organizations;

public class OfficeCoverageService(IRecordTransactions records, IParishAccess access, MfaAccountAccess proof, TimeProvider clock)
{
    private static readonly string[] OfficeDuties =
        [Permissions.PeopleWrite, Permissions.RequestsManage, Permissions.RegistrationsManage, Permissions.SacramentsRecord, Permissions.CommunicationsManage];

    public async Task<OfficeCoverageDto> CoverageAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.AccessManage, ct);
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish };
        var now = clock.GetUtcNow();
        var requests = (await records.CollectAsync<ParishRequest>(scope, "parishRequest", ct, 5000)).Select(r => r.Value)
            .Where(r => r.AssignedTo is not null && !RequestService.Terminal.Contains(r.Status)).ToList();
        var incidents = (await records.CollectAsync<Incident>(scope, "incident", ct, 2000)).Select(r => r.Value)
            .Where(i => i.HandlerAccountId is not null && i.Status != "Closed").ToList();
        var holders = (await records.CollectAsync<AccessGrant>(scope, "grant", ct, 500)).Select(g => g.Value)
            .Where(g => g.AccountId != root.Value.OwnerAccountId)
            .Select(g => (Grant: g, Duties: OfficeDuties.Where(d => g.Permits(d, now)).ToArray())).Where(x => x.Duties.Length > 0)
            .GroupBy(x => x.Grant.AccountId, StringComparer.Ordinal)
            .Select(group => new OfficeHolderDto
            {
                AccountId = group.Key, Duties = group.SelectMany(x => x.Duties).Distinct(StringComparer.Ordinal).ToArray(), EndsAt = group.Max(x => x.Grant.EndsAt),
                OpenRequests = requests.Count(r => r.AssignedTo == group.Key), OpenIncidents = incidents.Count(i => i.HandlerAccountId == group.Key)
            }).OrderBy(h => h.AccountId, StringComparer.Ordinal).ToArray();
        return new OfficeCoverageDto
        {
            Holders = holders, NoOfficeHolder = holders.Length == 0,
            Fallback = "Without a secretary, appointed priests and the parish owner carry out office duties within their own access; nothing is reassigned automatically."
        };
    }
}
