// Purpose: the member portal's "My resources": active ministry stock shared with every ministry the signed-in member currently belongs to.
// Main functions: ListAsync reads the account's own person link, its current memberships and each active ministry's active stock,
// applying the same member rule as the per-ministry available-stock route; storage locations and account ids are never returned.
// It reads ministry records only and writes nothing.

using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.PersonalWorkspace;

public class MemberMinistryResourceService(IRecordTransactions records, MinistryAccess access, TimeProvider clock)
{
    internal const int MaxMinistries = 50;
    internal const int MaxItems = 500;

    public async Task<MemberMinistryResourcesDto> ListAsync(string parish, CancellationToken ct)
    {
        // Personal capacity only (no appointment header, no recovery session), with an active claimed link to an unarchived person.
        var link = await access.OwnLinkAsync(parish, ct);
        var person = link.Value.PersonId;
        var now = clock.GetUtcNow();
        var scope = MinistryAccess.Scope(parish);
        var groups = new List<Ministry>();
        var truncated = false;
        string? cursor = null;
        do
        {
            var page = await records.PageAsync<MinistryMembership>(scope, "ministryMembership", 100, cursor, ct, Equal("personId", person));
            foreach (var row in page.Items)
            {
                var membership = row.Value;
                if (membership.PersonId != person || !membership.Current(now) || groups.Any(g => g.Id == membership.MinistryId))
                    continue;
                if (!await access.IsCurrentMemberAsync(parish, membership.MinistryId, person, now, ct))
                    continue;
                var group = await records.ReadAsync<Ministry>(scope, "ministry:" + membership.MinistryId, ct);
                if (group?.Value is not { Status: "Active" } value || value.ParishId != parish || value.Id != membership.MinistryId)
                    continue;
                if (groups.Count == MaxMinistries)
                {
                    truncated = true;
                    break;
                }
                groups.Add(value);
            }
            cursor = page.ContinuationToken;
        } while (cursor is not null && !truncated);

        var items = new List<MemberMinistryResourceDto>();
        foreach (var group in groups.OrderBy(g => g.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(g => g.Id, StringComparer.Ordinal))
        {
            var rows = new List<MinistryStock>();
            string? next = null;
            do
            {
                var page = await records.PageAsync<MinistryStock>(scope, "ministryStock", 100, next, ct,
                    Equal("ministryId", group.Id), Equal("status", "Active"));
                rows.AddRange(page.Items.Select(row => row.Value)
                    .Where(stock => stock.ParishId == parish && stock.MinistryId == group.Id && stock.Status == "Active"));
                next = page.ContinuationToken;
            } while (next is not null && items.Count + rows.Count <= MaxItems);
            if (next is not null)
                truncated = true;
            foreach (var stock in rows.OrderBy(s => s.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(s => s.Id, StringComparer.Ordinal))
            {
                if (items.Count == MaxItems)
                {
                    truncated = true;
                    break;
                }
                items.Add(new MemberMinistryResourceDto
                {
                    Id = stock.Id,
                    MinistryId = group.Id,
                    MinistryName = group.Name,
                    Name = stock.Name,
                    Total = stock.Total,
                    OnLoan = stock.OnLoan,
                    Available = Math.Max(0, stock.Total - stock.OnLoan),
                    UpdatedAt = stock.UpdatedAt
                });
            }
            if (items.Count == MaxItems && truncated)
                break;
        }
        return new MemberMinistryResourcesDto { Items = items.ToArray(), Truncated = truncated };
    }

    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
}
