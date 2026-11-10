// Purpose: counts distinct open, actionable cases per parish queue for the current viewer. A queue appears only when the viewer holds its
// permission (restricted queues such as incidents need their own duty), so no count leaks; completed, withdrawn and cancelled work is excluded.
// Main function: OverviewAsync.

using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Reporting;

public class WorkOverviewService(IRecordTransactions records, IParishAccess access, MfaAccountAccess proof, TimeProvider clock)
{
    private sealed record Queue(string Area, string Name, string Permission, string Type, string[] Statuses, string Route, string Unit = "cases");

    // Each queue: the permission that already guards its list route, the stored type and the open statuses counted.
    private static readonly Queue[] Queues =
    [
        new("Requests", "Open requests", Permissions.RequestsManage, "parishRequest", [], "/requests"),
        new("People", "Membership requests", Permissions.PeopleWrite, "membershipRequest", ["Submitted", "NeedsInformation"], "/membership-requests"),
        new("People", "Profile corrections", Permissions.PeopleWrite, "profileCorrection", ["Pending"], "/profile-corrections"),
        new("People", "Data closure requests", Permissions.PeopleWrite, "dataClosure", ["Submitted"], "/data-closure-requests"),
        new("People", "Person invitations needing review", Permissions.PeopleWrite, "personInvitation", ["NeedsReview"], "/person-invitations"),
        new("Finance", "Expenses awaiting approval", Permissions.FinanceApprove, "expense", ["Submitted"], "/finance/expenses"),
        new("Finance", "Unmatched bank lines", Permissions.FinancePost, "bankLine", ["Unmatched"], "/finance/bank/lines", "lines"),
        new("Finance", "Outstanding bank differences", Permissions.FinanceApprove, "bankLine", ["Outstanding"], "/finance/bank/lines", "lines"),
        new("Sacraments", "Register corrections awaiting decision", Permissions.SacramentsRecord, "sacramentCorrection", ["Pending"], "/sacraments/corrections"),
        new("Care", "Open incidents", Permissions.IncidentsManage, "incident", ["Recorded", "Assigned", "FollowUp", "Resolved"], "/incidents")
    ];

    public async Task<WorkOverviewDto> OverviewAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish };
        var allowed = new Dictionary<string, bool>(StringComparer.Ordinal);
        var counts = new List<WorkCountDto>();
        foreach (var queue in Queues)
        {
            if (!allowed.TryGetValue(queue.Permission, out var ok))
                allowed[queue.Permission] = ok = await AllowedAsync(parish, queue.Permission, ct);
            if (!ok)
                continue;
            // Requests have many open stages, so they count everything not completed, declined, withdrawn or cancelled.
            var count = queue.Statuses.Length == 0
                ? (await records.CollectAsync<ParishRequest>(scope, queue.Type, ct, 20000)).Count(r => !Services.Requests.RequestService.Terminal.Contains(r.Value.Status))
                : 0;
            foreach (var status in queue.Statuses)
                count += (await records.CollectAsync<object>(scope, queue.Type, ct, 20000, new RecordCondition { Path = "status", Comparison = "eq", Value = status })).Count;
            counts.Add(new WorkCountDto { Area = queue.Area, Queue = queue.Name, Count = count, Unit = queue.Unit, Statuses = queue.Statuses.Length == 0 ? ["not completed, declined, withdrawn or cancelled"] : queue.Statuses, Route = "/api/parishes/" + parish + queue.Route });
        }
        if (allowed.Count > 0 && !allowed.Values.Any(v => v))
            throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        return new WorkOverviewDto { ParishId = parish, GeneratedAt = clock.GetUtcNow(), Counts = [.. counts] };
    }

    private async Task<bool> AllowedAsync(string parish, string permission, CancellationToken ct)
    {
        try { await access.RequireAsync(parish, permission, ct); return true; }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { return false; }
    }
}
