// Purpose: resolves a broadcast's audience from current facts only, for interactive previews and sends and for scheduled sends: active parish links
// (and current ministry membership), active verified accounts, minus the optional-topic opt-out.
// Main function: ResolveAsync returns the recipient account ids and how many were skipped by preference; it refuses audiences above
// BroadcastService.MaximumRecipients.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class BroadcastAudience(IRecordTransactions records, IAccountDirectory accounts, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordScope Account(string account) => new() { Area = RecordArea.Account, OwnerId = account };

    // ponytail: up to two point reads per candidate; a resumable fan-out job is needed beyond MaximumRecipients.
    public async Task<(List<string> Recipients, int Skipped)> ResolveAsync(string parish, Broadcast item, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var links = (await records.CollectAsync<PersonAccountLink>(Scope(parish), "personAccountLink", ct, 5000))
            .Select(r => r.Value).Where(l => l.Active && l.ParishId == parish);
        if (item.Audience == "Ministry")
        {
            var people = (await records.CollectAsync<MinistryMembership>(Scope(parish), "ministryMembership", ct, 5000,
                    new RecordCondition { Path = "ministryId", Comparison = "eq", Value = item.MinistryId! }))
                .Where(m => m.Value.Current(now)).Select(m => m.Value.PersonId).ToHashSet(StringComparer.Ordinal);
            links = links.Where(l => people.Contains(l.PersonId));
        }
        var candidates = links.Select(l => l.AccountId).Distinct(StringComparer.Ordinal).ToList();
        if (candidates.Count > BroadcastService.MaximumRecipients)
            throw new DomainException("batch_limit", "This audience is larger than one broadcast can hold; narrow it to a ministry.", FailureKind.Conflict);
        var recipients = new List<string>();
        var skipped = 0;
        foreach (var account in candidates)
        {
            if (!await accounts.IsActiveVerifiedAsync(account, ct)) continue;
            var preferences = await records.ReadAsync<NotificationPreferences>(Account(account), "notificationPreferences", ct);
            if (preferences?.Value.MutedTopics.Contains(BroadcastService.Topic, StringComparer.Ordinal) == true) skipped++;
            else recipients.Add(account);
        }
        return (recipients, skipped);
    }
}
