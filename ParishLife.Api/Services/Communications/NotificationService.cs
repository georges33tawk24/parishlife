// Purpose: atomically stages required parish notification work, stores deduplicated recipient notices and acknowledges only verified storage.
// Main functions: StageRequired, DispatchAsync, DispatchWorkAsync, NotifyAsync, ListAsync, SetStateAsync, PreferencesAsync and SavePreferencesAsync.
// Store/confirm helpers bind versioned identities to receipts; exact saved-work dispatch supports parish-scoped v2 and legacy obligations.
// Legacy NotifyAsync, recipient identities/receipts and read state remain compatible; pending work survives failure without claiming external delivery.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using RequestFailedException = Azure.RequestFailedException;
using Microsoft.Azure.Cosmos;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class NotificationService(IRecordTransactions records, ICurrentActor actor, TimeProvider clock, NotificationAudience audiences,
    ILogger<NotificationService> logger)
{
    private static RecordScope Scope(string account) => new() { Area = RecordArea.Account, OwnerId = account };
    private static RecordScope Parish(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private const string PreferencesKey = "notificationPreferences";

    internal RecordChange StageRequired(string parish, string account, string topic, string title, string? link, string dedupKey,
        string audience, string resourceId, DateTimeOffset at)
    {
        if (!NotificationAudience.Supported.Contains(audience))
            throw new DomainException("invalid_notification_audience", "Use a supported typed recipient audience.");
        var work = new NotificationWork
        {
            Id = ScopedId(account, parish, dedupKey).ToString("N"), IdentityVersion = 2,
            ParishId = parish, AccountId = account, Topic = topic, Title = title, Link = link,
            DedupKey = dedupKey, Audience = audience, ResourceId = resourceId, CreatedAt = Guard.Utc(at)
        };
        return RecordChange.Create("notificationWork:" + work.Id, "notificationWork", work);
    }

    internal async Task DispatchAsync(string parish, string account, string dedupKey, CancellationToken ct)
    {
        try
        {
            // A producer dispatches only work that actually exists. Old completed source operations are never retrofitted here.
            var current = ScopedId(account, parish, dedupKey).ToString("N");
            if (await records.ReadAsync<NotificationWork>(Parish(parish), "notificationWork:" + current, ct) is not null)
            {
                await DispatchWorkAsync(parish, current, ct);
                return;
            }
            var legacy = LegacyId(account, dedupKey).ToString("N");
            await DispatchWorkAsync(parish, legacy, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception error) when (DeferredFailure(error)) { LogPending(error); }
    }

    internal async Task DispatchWorkAsync(string parish, string id, CancellationToken ct)
    {
        try
        {
            var scope = Parish(parish);
            var key = "notificationWork:" + id;
            var row = await records.ReadAsync<NotificationWork>(scope, key, ct);
            if (row is null || row.Value.Status != "Pending") return;
            var work = row.Value;
            var expectedId = work.IdentityVersion switch
            {
                1 => LegacyId(work.AccountId, work.DedupKey),
                2 => ScopedId(work.AccountId, parish, work.DedupKey),
                _ => throw new DomainException("unsupported_notification_identity", "The saved notification identity needs a compatible reader.", FailureKind.Unavailable)
            };
            if (work.Id != id || work.ParishId != parish || id != expectedId.ToString("N"))
                throw new DomainException("notification_work_mismatch", "The saved notification work needs review.", FailureKind.Unavailable);
            if (!await audiences.IsEligibleAsync(work, ct)) return;
            var recipientId = work.IdentityVersion == 1
                ? await StoreVersionOneWorkAsync(work, ct)
                : await StoreScopedAsync(work, ct);
            // Recheck after the account-partition write. Neither a changed recipient nor an inactive account is marked stored by stale work.
            if (!await audiences.IsEligibleAsync(work, ct)) return;
            work.Status = "Stored";
            work.RecipientNotificationId = recipientId;
            work.StoredAt = clock.GetUtcNow();
            var acknowledgment = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes("notification-ack\n" + parish + "\n" + id)).AsSpan(0, 16));
            var account = work.AccountId;
            var dedupKey = work.DedupKey;
            object fingerprint = work.IdentityVersion == 1
                ? new { id, account, dedupKey }
                : new { identityVersion = 2, id, account, parish, dedupKey, recipientNotificationId = recipientId };
            var receiptScope = work.IdentityVersion == 1 ? "notification-work-ack:v1" : "notification-work-ack:v2:" + parish;
            var op = Operation.Create(acknowledgment, "system:notifications", fingerprint, clock, receiptScope);
            await records.CommitAsync(scope, op, "notification.acknowledge", id,
                [RecordChange.Replace(key, "notificationWork", work, row.Version)], new CommandResult { Id = id, Status = "Stored" }, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception error) when (DeferredFailure(error))
        {
            // The source transaction already committed. Storage/configuration failures leave this pending, possibly requiring operator repair;
            // they do not turn the effective business action into a failure or imply that another tick will fix missing permissions.
            LogPending(error);
        }
    }

    // Compatibility for explicit direct notifications, including optional notices and their existing mute semantics.
    // Required source workflows use StageRequired in their own transaction, followed by DispatchAsync.
    internal async Task NotifyAsync(string account, string? parish, string topic, string title, string? link, bool required, string dedupKey, CancellationToken ct)
    {
        if (!required && (await records.ReadAsync<NotificationPreferences>(Scope(account), PreferencesKey, ct))?.Value.MutedTopics.Contains(topic) == true)
            return;
        await StoreLegacyAsync(account, parish, topic, title, link, required, dedupKey, clock.GetUtcNow(), ct);
    }

    private Task<string> StoreLegacyAsync(string account, string? parish, string topic, string title, string? link, bool required, string dedupKey,
        DateTimeOffset createdAt, CancellationToken ct)
    {
        var id = LegacyId(account, dedupKey);
        var item = new Notification
        {
            Id = id.ToString("N"), AccountId = account, ParishId = parish, Kind = required ? "Required" : "Optional", Topic = topic, Title = title,
            Link = link, CreatedAt = createdAt
        };
        // This contract predates the outbox; reuse it exactly so already stored notices retain their receipt and original timestamp.
        var operation = Operation.Create(id, "system:notifications", new { topic, dedupKey }, clock, "notification");
        return StoreIdentityAsync(item, operation, ct);
    }

    private async Task<string> StoreScopedAsync(NotificationWork work, CancellationToken ct)
    {
        var id = ScopedId(work.AccountId, work.ParishId, work.DedupKey);
        var item = Expected(work, id);
        var operation = ScopedOperation(work, id);
        // A scoped row is authoritative when present, including a row that needs receipt/operator recovery.
        if (await records.ReadAsync<Notification>(Scope(work.AccountId), "notification:" + item.Id, ct) is { } scoped)
        {
            await ConfirmAsync(scoped.Value, item, operation, ct);
            return item.Id;
        }
        var legacyId = LegacyId(work.AccountId, work.DedupKey);
        var expectedLegacy = Expected(work, legacyId);
        var legacy = await records.ReadAsync<Notification>(Scope(work.AccountId), "notification:" + expectedLegacy.Id, ct);
        if (legacy is not null)
        {
            if (Matches(legacy.Value, expectedLegacy))
            {
                // Reuse only a fully proven same-event legacy notice. A matching row without its receipt remains pending.
                var topic = work.Topic;
                var dedupKey = work.DedupKey;
                var legacyOperation = Operation.Create(legacyId, "system:notifications", new { topic, dedupKey }, clock, "notification");
                await ConfirmAsync(legacy.Value, expectedLegacy, legacyOperation, ct);
                return expectedLegacy.Id;
            }
            // Only the historical missing-parish key boundary can fall forward. Same-parish payload changes and malformed
            // identity are conflicts, not permission to create another notice under a different key.
            if (!ForeignLegacy(legacy.Value, work, expectedLegacy.Id)) throw IdentityConflict();
        }
        return await StoreIdentityAsync(item, operation, ct);
    }

    private async Task<string> StoreVersionOneWorkAsync(NotificationWork work, CancellationToken ct)
    {
        var scopedId = ScopedId(work.AccountId, work.ParishId, work.DedupKey);
        var expectedScoped = Expected(work, scopedId);
        if (await records.ReadAsync<Notification>(Scope(work.AccountId), "notification:" + expectedScoped.Id, ct) is { } scoped)
        {
            // An earlier repair may have stored the scoped notice before its acknowledgment was lost.
            await ConfirmAsync(scoped.Value, expectedScoped, ScopedOperation(work, scopedId), ct);
            return expectedScoped.Id;
        }
        var legacyId = LegacyId(work.AccountId, work.DedupKey).ToString("N");
        var legacy = await records.ReadAsync<Notification>(Scope(work.AccountId), "notification:" + legacyId, ct);
        if (legacy?.Value is { } existing && ForeignLegacy(existing, work, legacyId))
        {
            // Only a known, valid pending source obligation can take this narrow cross-parish recovery path.
            // Preserve its v1 work identity and the foreign notice; acknowledge the actual scoped recipient ID instead.
            return await StoreScopedAsync(work, ct);
        }
        return await StoreLegacyAsync(work.AccountId, work.ParishId, work.Topic, work.Title, work.Link,
            required: true, work.DedupKey, work.CreatedAt, ct);
    }

    private async Task<string> StoreIdentityAsync(Notification item, Operation operation, CancellationToken ct)
    {
        var scope = Scope(item.AccountId);
        var key = "notification:" + item.Id;
        if (await records.ReadAsync<Notification>(scope, key, ct) is not { } existing)
        {
            try
            {
                await records.CommitAsync(scope, operation,
                    "notification.store", item.Id, [RecordChange.Create(key, "notification", item)], new CommandResult { Id = item.Id, Status = item.Status }, ct);
            }
            catch (DomainException error) when (error.Code == "write_conflict") { /* Only a matching current recipient row can prove this race succeeded. */ }
            catch (DomainException error) when (error.Code == "operation_reused") { throw IdentityConflict(); }
            existing = await records.ReadAsync<Notification>(scope, key, ct)
                ?? throw new DomainException("notification_storage_unconfirmed", "The notification has not been confirmed in its recipient account.", FailureKind.Unavailable);
        }
        await ConfirmAsync(existing.Value, item, operation, ct);
        return item.Id;
    }

    private async Task ConfirmAsync(Notification actual, Notification expected, Operation operation, CancellationToken ct)
    {
        if (!Matches(actual, expected))
            throw IdentityConflict();
        try
        {
            if ((await records.ReplayAsync<CommandResult>(Scope(expected.AccountId), operation, ct))?.Id != expected.Id)
                throw new DomainException("notification_storage_unconfirmed", "The recipient notification receipt has not been confirmed.", FailureKind.Unavailable);
        }
        catch (DomainException error) when (error.Code == "operation_reused") { throw IdentityConflict(); }
    }

    private static Guid LegacyId(string account, string dedupKey)
        => new(SHA256.HashData(Encoding.UTF8.GetBytes(account + "\n" + dedupKey)).AsSpan(0, 16));

    // Domain-separated canonical string-array encoding keeps parish boundaries unambiguous without storing private content in the identity.
    private static Guid ScopedId(string account, string parish, string dedupKey)
        => new(SHA256.HashData(Encoding.UTF8.GetBytes("ParishLife.Notification.v2\n" + JsonSerializer.Serialize(new[] { account, parish, dedupKey }))).AsSpan(0, 16));

    private Operation ScopedOperation(NotificationWork work, Guid id)
        => Operation.Create(id, "system:notifications", new { identityVersion = 2, parish = work.ParishId, topic = work.Topic, dedupKey = work.DedupKey },
            clock, "notification:v2:" + work.ParishId);

    private static Notification Expected(NotificationWork work, Guid id) => new()
    {
        Id = id.ToString("N"), AccountId = work.AccountId, ParishId = work.ParishId, Kind = "Required", Topic = work.Topic,
        Title = work.Title, Link = work.Link, CreatedAt = work.CreatedAt
    };

    private static bool ForeignLegacy(Notification actual, NotificationWork work, string legacyId)
        => actual.Id == legacyId && actual.AccountId == work.AccountId
            && !string.IsNullOrWhiteSpace(actual.ParishId) && actual.ParishId != work.ParishId;

    private void LogPending(Exception error)
        => logger.LogWarning("Required notification remains pending. Failure type: {FailureType}", error.GetType().Name);

    // Read/archive state, historical title wording and the original timestamp survive legacy retries; recipient identity and source link must agree.
    private static bool Matches(Notification actual, Notification expected)
        => actual.Id == expected.Id && actual.AccountId == expected.AccountId && actual.ParishId == expected.ParishId
            && actual.Kind == expected.Kind && actual.Topic == expected.Topic && actual.Link == expected.Link;

    private static DomainException IdentityConflict()
        => new("notification_identity_conflict", "The notification identity already belongs to another recipient source.", FailureKind.Conflict);

    private static bool DeferredFailure(Exception error) => error switch
    {
        DomainException domain => domain.Kind is FailureKind.Conflict or FailureKind.Unavailable,
        RequestFailedException or CosmosException => true,
        IOException or HttpRequestException or TimeoutException or OperationCanceledException => true,
        _ => false
    };

    public async Task<Page<NotificationDto>> ListAsync(string? status, int size, string? cursor, CancellationToken ct)
    {
        var page = status is null
            ? await records.PageAsync<Notification>(Scope(actor.AccountId), "notification", size, cursor, ct)
            : await records.PageAsync<Notification>(Scope(actor.AccountId), "notification", size, cursor, ct,
                new RecordCondition { Path = "status", Comparison = "eq", Value = Guard.Text(status, "Status", 20) });
        return new Page<NotificationDto> { Items = page.Items.Select(r => Project(r.Value)).ToArray(), ContinuationToken = page.ContinuationToken };
    }

    public async Task<NotificationDto> SetStateAsync(string id, NotificationStateDto request, CancellationToken ct)
    {
        if (request.Status is not ("Read" or "Unread" or "Archived"))
            throw new DomainException("invalid_input", "Use Read, Unread or Archived.");
        var key = "notification:" + id;
        var row = await records.ReadAsync<Notification>(Scope(actor.AccountId), key, ct)
            ?? throw new DomainException("resource_not_found", "The requested notification is unavailable.", FailureKind.NotFound);
        row.Value.Status = request.Status;
        row.Value.ReadAt = request.Status == "Unread" ? null : row.Value.ReadAt ?? clock.GetUtcNow();
        await records.CommitAsync(Scope(actor.AccountId), Operation.Create(Guid.NewGuid(), actor.AccountId, new { id, request.Status }, clock), "notification.state", id,
            [RecordChange.Replace(key, "notification", row.Value, row.Version)], new CommandResult { Id = id, Status = row.Value.Status }, ct);
        return Project(row.Value);
    }

    public async Task<NotificationPreferencesDto> PreferencesAsync(CancellationToken ct)
    {
        var value = (await records.ReadAsync<NotificationPreferences>(Scope(actor.AccountId), PreferencesKey, ct))?.Value ?? new NotificationPreferences();
        return new NotificationPreferencesDto { MutedTopics = [.. value.MutedTopics], Language = value.Language, DigestOptional = value.DigestOptional };
    }

    public async Task<NotificationPreferencesDto> SavePreferencesAsync(NotificationPreferencesDto request, CancellationToken ct)
    {
        if (request.MutedTopics is null || request.MutedTopics.Length > 30 || request.MutedTopics.Any(t => string.IsNullOrWhiteSpace(t) || t.Length > 60)
            || request.Language is not ("en" or "fr" or "ar"))
            throw new DomainException("invalid_input", "Use up to 30 short topic names and en, fr or ar.");
        var existing = await records.ReadAsync<NotificationPreferences>(Scope(actor.AccountId), PreferencesKey, ct);
        var value = new NotificationPreferences { MutedTopics = request.MutedTopics.Distinct(StringComparer.Ordinal).ToArray(), Language = request.Language, DigestOptional = request.DigestOptional };
        await records.CommitAsync(Scope(actor.AccountId), Operation.Create(Guid.NewGuid(), actor.AccountId, request, clock), "notification.preferences", actor.AccountId,
            [existing is null ? RecordChange.Create(PreferencesKey, "notificationPreferences", value) : RecordChange.Replace(PreferencesKey, "notificationPreferences", value, existing.Version)],
            new CommandResult { Id = actor.AccountId, Status = "Saved" }, ct);
        return await PreferencesAsync(ct);
    }

    private static NotificationDto Project(Notification x) => new()
    {
        Id = x.Id, ParishId = x.ParishId, Kind = x.Kind, Topic = x.Topic, Title = x.Title, Link = x.Link, Status = x.Status, CreatedAt = x.CreatedAt, ReadAt = x.ReadAt
    };
}
