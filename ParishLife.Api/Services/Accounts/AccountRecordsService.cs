// Purpose: "My parish records" on My account: for each parish the account follows where it is actively linked to a Person, that
// person's own official facts and their own profile corrections, in one read.
// Main function: RecordsAsync. It shows nothing the account is not already entitled to: only its own linked, unarchived Person in a
// verified parish (MinistryAccess.OwnLinkAsync), never other household members or office-only data. Corrections are proposed and
// withdrawn through the existing per-parish profile-correction routes, reviewed by a different office reviewer (MembershipService).
// Personal capacity only: never an acting appointment or a recovery session.

using ParishLife.Api.DTOs.Accounts.Records;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Services.Accounts;

public class AccountRecordsService(IRecordTransactions records, IParishRepository parishes, MinistryAccess own, MembershipService memberships, ICurrentActor actor)
{
    private static RecordScope Parish(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };

    public async Task<IReadOnlyList<AccountParishRecordDto>> RecordsAsync(CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var result = new List<AccountParishRecordDto>();
        var account = new RecordScope { Area = RecordArea.Account, OwnerId = actor.AccountId };
        foreach (var follow in await records.CollectAsync<ParishFollow>(account, "parishFollow", ct, 200))
        {
            var parish = follow.Value.ParishId;
            var link = await records.ReadAsync<PersonAccountLink>(Parish(parish), "personAccountLink:" + actor.AccountId, ct);
            if (link?.Value.Active != true)
                continue;
            try
            {
                // Rechecks the link, its claim, the person and the parish exactly as the per-parish own-data routes do.
                var current = await own.OwnLinkAsync(parish, ct);
                var person = (await records.ReadAsync<Person>(Parish(parish), "person:" + current.Value.PersonId, ct))!.Value;
                var name = (await parishes.GetAsync(parish, ct))?.Value.Name ?? string.Empty;
                var corrections = await memberships.CorrectionsAsync(parish, true, ct);
                result.Add(new AccountParishRecordDto
                {
                    ParishId = parish, ParishName = name, PersonId = person.Id, GivenName = person.GivenName, FamilyName = person.FamilyName,
                    BirthDate = person.BirthDate, Contact = person.Contact,
                    Corrections = corrections.OrderByDescending(c => c.Value.SubmittedAt).ToArray()
                });
            }
            catch (DomainException error) when (error.Kind == FailureKind.NotFound)
            {
                // An ended, unclaimed or archived link, or an unverified parish, is simply not listed.
            }
        }
        return result.OrderBy(r => r.ParishName, StringComparer.Ordinal).ToArray();
    }
}
