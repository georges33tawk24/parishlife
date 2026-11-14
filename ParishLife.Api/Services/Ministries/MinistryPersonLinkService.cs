// Purpose: records reviewed, unique person/account identity matches without granting ministry membership or staff authority.
// Main functions: LinkAsync atomically claims the person and writes the reviewed link; GetOwnAsync, GetAsync and GetByPersonAsync return safe current projections.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Identity;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Ministries;

public class MinistryPersonLinkService(IRecordTransactions records, MinistryAccess ministryAccess, IParishAccess access,
    ICurrentActor actor, MfaAccountAccess proof, UserManager<ParishUser> users, TimeProvider clock)
{
    public async Task<PersonAccountLinkDto> LinkAsync(string parish, LinkMinistryPersonDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.PeopleWrite, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        var account = Guard.Id(request.AccountId);
        var personId = Guard.Id(request.PersonId);
        if (account == actor.AccountId) throw MinistryAccess.State("A different authorized reviewer must match this account to a person.");
        var target = await users.FindByIdAsync(account);
        if (target is not { Active: true } || !AccountVerification.IsVerified(target) || await users.IsLockedOutAsync(target)) throw MinistryAccess.Missing();
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-account-link:v2:" + account);
        var scope = MinistryAccess.Scope(parish);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return (await GetAsync(parish, account, ct)).Value;
        var person = await records.ReadAsync<Person>(scope, "person:" + personId, ct);
        if (person?.Value.Archived != false || person.Value.ParishId != parish) throw MinistryAccess.Missing();
        var key = "personAccountLink:" + account;
        var old = await records.ReadAsync<PersonAccountLink>(scope, key, ct);
        if (old is not null && (old.Value.PersonId != personId || !old.Value.Active || old.Value.AccountId != account))
            throw MinistryAccess.State("Changing or reactivating an existing identity link requires a reviewed identity correction.");
        var claimKey = "personAccountClaim:" + personId;
        var claim = await records.ReadAsync<CommandResult>(scope, claimKey, ct);
        if (claim is not null && (claim.Value.Id != account || claim.Value.Status != "Linked"))
            throw MinistryAccess.State("The person is already claimed by another reviewed identity.");
        var link = new PersonAccountLink
        {
            Id = account, ParishId = parish, PersonId = personId, AccountId = account,
            VerifiedBy = actor.AccountId, VerifiedAt = op.At, EvidenceReference = Guard.Text(request.EvidenceReference, "Identity matching evidence", 500), Active = true
        };
        var changes = new List<RecordChange>
        {
            MinistryAccess.Fence(root), RecordChange.Replace("person:" + personId, "person", person.Value, person.Version),
            old is null ? RecordChange.Create(key, "personAccountLink", link)
                : RecordChange.Replace(key, "personAccountLink", link, Versions.Require(request.Version))
        };
        if (claim is null) changes.Add(RecordChange.Create(claimKey, "personAccountClaim", new CommandResult { Id = account, Status = "Linked" }));
        else changes.Add(RecordChange.Replace(claimKey, "personAccountClaim", claim.Value, claim.Version));
        await records.CommitAsync(scope, op, "person.link_account", personId, changes, new CommandResult { Id = account, Status = "Linked" }, ct);
        return View(link);
    }
    public async Task<Versioned<PersonAccountLinkDto>> GetOwnAsync(string parish, CancellationToken ct)
    {
        var link = await ministryAccess.OwnLinkAsync(parish, ct);
        return new() { Value = View(link.Value), Version = link.Version };
    }
    public async Task<Versioned<PersonAccountLinkDto>> GetAsync(string parish, string account, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await access.RequireAsync(parish, Permissions.PeopleWrite, ct);
        var row = await records.ReadAsync<PersonAccountLink>(MinistryAccess.Scope(parish), "personAccountLink:" + account, ct) ?? throw MinistryAccess.Missing();
        return new() { Value = View(row.Value), Version = row.Version };
    }
    // The reverse lookup (person to account) needed to appoint a roster member as a leader; same people.write boundary as GetAsync.
    public async Task<Versioned<PersonAccountLinkDto>> GetByPersonAsync(string parish, string person, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await access.RequireAsync(parish, Permissions.PeopleWrite, ct);
        var scope = MinistryAccess.Scope(parish);
        var claim = await records.ReadAsync<CommandResult>(scope, "personAccountClaim:" + person, ct);
        if (claim?.Value.Status != "Linked") throw MinistryAccess.Missing();
        var row = await records.ReadAsync<PersonAccountLink>(scope, "personAccountLink:" + claim.Value.Id, ct);
        if (row?.Value.Active != true || row.Value.PersonId != person || row.Value.ParishId != parish) throw MinistryAccess.Missing();
        return new() { Value = View(row.Value), Version = row.Version };
    }
    private static PersonAccountLinkDto View(PersonAccountLink value) => new()
    { ParishId = value.ParishId, AccountId = value.AccountId, PersonId = value.PersonId, Active = value.Active, VerifiedAt = value.VerifiedAt };
}
