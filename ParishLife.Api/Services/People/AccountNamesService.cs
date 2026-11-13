// Purpose: resolves the account ids that parish records carry (who sent, recorded, approved or requested something) to display
// names, revealing only what the caller may see in that parish. Ids that may not be revealed are left out, never reported.
// Main functions: ListAsync. Current capacity holders (an effective priest appointment, a current parish grant, a current ministry
// leader or assistant) are named to any account related to the parish (a linked member, a follower or a capacity holder). Any other
// account is named only to a caller with people.read and the office module in the parish, and only when it is actively linked to a
// person of that parish. Inactive accounts and accounts without a display name are never named.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.People;

public class AccountNamesService(IRecordTransactions records, IParishAccess access, IParishRepository parishes, ICurrentActor actor, IUserStore<ParishUser> users, TimeProvider clock)
{
    public const int MaxIds = 100;
    private const int MaxRowsPerKind = 500;

    private static RecordScope Parish(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };

    public async Task<IReadOnlyList<AccountNameDto>> ListAsync(string parish, string? ids, CancellationToken ct)
    {
        var wanted = Parse(ids);
        var root = await parishes.GetAsync(parish, ct);
        if (root is null || root.Value.Status is ParishStatus.Closed or ParishStatus.Suspended)
            return [];
        var holders = await CapacityHoldersAsync(root.Value, clock.GetUtcNow(), ct);
        var caller = actor.AccountId;
        var related = holders.Contains(caller) || await IsLinkedAsync(parish, caller, ct) || await FollowsAsync(parish, caller, ct);
        var office = await MayReadPeopleAsync(parish, ct);
        if (!related && !office)
            return [];

        var names = new List<AccountNameDto>();
        foreach (var id in wanted)
        {
            var visible = (related && holders.Contains(id)) || (office && await IsLinkedAsync(parish, id, ct));
            if (!visible)
                continue;
            var user = await users.FindByIdAsync(id, ct);
            if (user is not { Active: true } || string.IsNullOrWhiteSpace(user.DisplayName))
                continue;
            names.Add(new AccountNameDto { AccountId = id, DisplayName = user.DisplayName.Trim() });
        }
        return names;
    }

    private static string[] Parse(string? ids)
    {
        var parts = (ids ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.Ordinal).ToArray();
        if (parts.Length == 0)
            throw new DomainException("ids_required", "List at least one account id.");
        if (parts.Length > MaxIds)
            throw new DomainException("too_many_ids", $"List at most {MaxIds} account ids.");
        if (parts.Any(id => id.Length > 100 || id.Any(char.IsControl)))
            throw new DomainException("invalid_id", "An account id is not valid.");
        return parts;
    }

    /* Accounts that currently hold a capacity in the parish. Each kind is read with one bounded query. */
    private async Task<HashSet<string>> CapacityHoldersAsync(Parish parish, DateTimeOffset now, CancellationToken ct)
    {
        var holders = new HashSet<string>(StringComparer.Ordinal);
        var scope = Parish(parish.Id);

        foreach (var row in await records.CollectAsync<AccessGrant>(scope, "grant", ct, MaxRowsPerKind))
        {
            var grant = row.Value;
            if (!grant.Revoked && grant.StartsAt <= now && (grant.EndsAt is null || now < grant.EndsAt)
                && grant.Allows.Except(grant.Denies, StringComparer.Ordinal).Any())
                holders.Add(grant.AccountId);
        }

        if (parish.JurisdictionArchdioceseId is { } archdiocese)
            foreach (var row in await records.CollectAsync<StaffAppointment>(scope, "staffAppointment", ct, MaxRowsPerKind))
            {
                var appointment = row.Value;
                if (appointment.Role == StaffAppointmentRole.Priest && appointment.ParishId == parish.Id
                    && appointment.ArchdioceseId == archdiocese && appointment.IsEffective(now))
                    holders.Add(appointment.AccountId);
            }

        var ministries = new Dictionary<string, bool>(StringComparer.Ordinal);
        foreach (var row in await records.CollectAsync<MinistryLeader>(scope, "ministryLeader", ct, MaxRowsPerKind))
        {
            var leader = row.Value;
            if (!leader.Current(now) || leader.Role is not ("Leader" or "Assistant"))
                continue;
            if (!ministries.TryGetValue(leader.MinistryId, out var exists))
            {
                var ministry = (await records.ReadAsync<Ministry>(scope, "ministry:" + leader.MinistryId, ct))?.Value;
                ministries[leader.MinistryId] = exists = ministry?.ParishId == parish.Id;
            }
            if (exists)
                holders.Add(leader.AccountId);
        }
        return holders;
    }

    /* An active, claimed link between the account and a current (not archived) person of the parish. */
    private async Task<bool> IsLinkedAsync(string parish, string account, CancellationToken ct)
    {
        var scope = Parish(parish);
        var link = (await records.ReadAsync<PersonAccountLink>(scope, "personAccountLink:" + account, ct))?.Value;
        if (link is not { Active: true } || link.AccountId != account || link.ParishId != parish)
            return false;
        var claim = (await records.ReadAsync<CommandResult>(scope, "personAccountClaim:" + link.PersonId, ct))?.Value;
        var person = (await records.ReadAsync<Person>(scope, "person:" + link.PersonId, ct))?.Value;
        return claim?.Id == account && claim.Status == "Linked" && person is { Archived: false } && person.ParishId == parish;
    }

    private async Task<bool> FollowsAsync(string parish, string account, CancellationToken ct)
        => await records.ReadAsync<ParishFollow>(new RecordScope { Area = RecordArea.Account, OwnerId = account }, "follow:" + parish, ct) is not null;

    private async Task<bool> MayReadPeopleAsync(string parish, CancellationToken ct)
    {
        try
        {
            await access.RequireAsync(parish, Permissions.PeopleRead, ct);
            await access.RequireModuleAsync(parish, "office", ct);
            return true;
        }
        catch (DomainException)
        {
            return false;
        }
    }
}
