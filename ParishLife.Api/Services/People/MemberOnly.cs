// Purpose: the owner's rule (21 November 2026) that people may themselves register for parish events, apply to join a ministry and ask
// for a sacrament online only when the parish records them as a Member (Person.RegisterStatus). Visitors, people the office has not
// recorded yet and accounts not linked to a parish record contact the parish office instead; office staff acting for someone are not
// limited by this rule.
// Main members: Code (members_only) and Require.

using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.People;

public static class MemberOnly
{
    public const string Code = "members_only";

    public static void Require(Person? person, string what)
    {
        if (person is not { RegisterStatus: "Member", Archived: false })
            throw new DomainException(Code,
                $"{what} is for parish members. If you belong to this parish, ask the parish office to record you as a member; otherwise contact the office directly.",
                FailureKind.Forbidden);
    }
}
