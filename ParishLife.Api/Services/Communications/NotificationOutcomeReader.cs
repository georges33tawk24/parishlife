// Purpose: aggregates saved notification-work outcomes for a source projection only after that feature has authorized its viewer.
// Main function: ReadAsync performs at most forty parish-scoped point reads, fails closed on unavailable/invalid work and preserves cancellation.
// This internal helper provides no standalone feed, recipient details or authority to read the source.

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class NotificationOutcomeReader(IRecordTransactions records)
{
    internal async Task<NotificationOutcomeDto> ReadAsync(string parish, IReadOnlyList<string>? workIds, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(parish)) return Outcome("Unconfirmed");
        if (workIds is null) return Outcome("NotTracked");
        if (workIds.Count == 0) return Outcome("NotRequired");
        if (workIds.Count > 40) return Outcome("Unconfirmed");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var id in workIds)
        {
            if (!Guid.TryParseExact(id, "N", out var parsed) || parsed == Guid.Empty) return Outcome("Unconfirmed");
            ids.Add(id);
        }
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish };
        var pending = false;
        foreach (var id in ids)
        {
            ct.ThrowIfCancellationRequested();
            Versioned<NotificationWork>? row;
            try { row = await records.ReadAsync<NotificationWork>(scope, "notificationWork:" + id, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception) { ct.ThrowIfCancellationRequested(); return Outcome("Unconfirmed"); }
            ct.ThrowIfCancellationRequested();
            if (row?.Value is not { } work || work.Id != id || work.ParishId != parish || work.IdentityVersion is not (1 or 2))
                return Outcome("Unconfirmed");
            if (work.Status == "Pending") pending = true;
            else if (work.Status != "Stored") return Outcome("Unconfirmed");
        }
        return Outcome(pending ? "Pending" : "Stored");
    }

    private static NotificationOutcomeDto Outcome(string status) => new()
    {
        Status = status,
        Meaning = status switch
        {
            "NotTracked" => "Notification status is not available for this update.",
            "NotRequired" => "No notification is needed for this update.",
            "Pending" => "Notification confirmation is pending. A notice may already be available in the app.",
            "Stored" => "Required notices are available in the app.",
            _ => "Notification status could not be confirmed. Check again later."
        }
    };
}
