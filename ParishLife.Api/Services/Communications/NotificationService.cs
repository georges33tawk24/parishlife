// Purpose: atomically stages required parish notification work, stores deduplicated recipient notices and acknowledges only verified storage.
// Main functions: StageRequired, DispatchAsync, compatible NotifyAsync, ListAsync, SetStateAsync, PreferencesAsync and SavePreferencesAsync.
// Pending work survives storage failure; "Stored" means available in-app, never external delivery or reading.

using System.Security.Cryptography;
using System.Text;
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
            Id = Id(account, dedupKey).ToString("N"), ParishId = parish, AccountId = account, Topic = topic, Title = title, Link = link,
            DedupKey = dedupKey, Audience = audience, ResourceId = resourceId, CreatedAt = Guard.Utc(at)
        };
        return RecordChange.Create("notificationWork:" + work.Id, "notificationWork", work);
    }

    internal async Task DispatchAsync(string parish, string account, string dedupKey, CancellationToken ct)
    {
        try
        {
            var id = Id(account, dedupKey).ToString("N");
            var scope = Parish(parish);
            var key = "notificationWork:" + id;
            var row = await records.ReadAsync<NotificationWork>(scope, key, ct);
            if (row is null || row.Value.Status != "Pending") return;
            var work = row.Value;
            if (work.Id != id || work.ParishId != parish || work.AccountId != account || work.DedupKey != dedupKey)
                throw new DomainException("notification_work_mismatch", "The saved notification work needs review.", FailureKind.Unavailable);
            if (!await audiences.IsEligibleAsync(work, ct)) return;
            await StoreAsync(account, parish, work.Topic, work.Title, work.Link, required: true, dedupKey, work.CreatedAt, ct);
            // Recheck after the account-partition write. Neither a changed recipient nor an inactive account is marked stored by stale work.
            if (!await audiences.IsEligibleAsync(work, ct)) return;
            work.Status = "Stored";
            work.StoredAt = clock.GetUtcNow();
            var acknowledgment = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes("notification-ack\n" + parish + "\n" + id)).AsSpan(0, 16));
            var op = Operation.Create(acknowledgment, "system:notifications", new { id, account, dedupKey }, clock, "notification-work-ack:v1");
            await records.CommitAsync(scope, op, "notification.acknowledge", id,
                [RecordChange.Replace(key, "notificationWork", work, row.Version)], new CommandResult { Id = id, Status = "Stored" }, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception error) when (DeferredFailure(error))
        {
            // The source transaction already committed. Storage/configuration failures leave this pending, possibly requiring operator repair;
            // they do not turn the effective business action into a failure or imply that another tick will fix missing permissions.
            logger.LogWarning("Required notification remains pending. Failure type: {FailureType}", error.GetType().Name);
        }
    }

    // Compatibility for explicit direct notifications, including optional notices and their existing mute semantics.
    // Required source workflows use StageRequired in their own transaction, followed by DispatchAsync.
    internal async Task NotifyAsync(string account, string? parish, string topic, string title, string? link, bool required, string dedupKey, CancellationToken ct)
    {
        if (!required && (await records.ReadAsync<NotificationPreferences>(Scope(account), PreferencesKey, ct))?.Value.MutedTopics.Contains(topic) == true)
            return;
        await StoreAsync(account, parish, topic, title, link, required, dedupKey, clock.GetUtcNow(), ct);
    }

    private async Task StoreAsync(string account, string? parish, string topic, string title, string? link, bool required, string dedupKey,
        DateTimeOffset createdAt, CancellationToken ct)
    {
        var id = Id(account, dedupKey);
        var key = "notification:" + id.ToString("N");
        var item = new Notification
        {
            Id = id.ToString("N"), AccountId = account, ParishId = parish, Kind = required ? "Required" : "Optional", Topic = topic, Title = title,
            Link = link, CreatedAt = createdAt
        };
        // This contract predates the outbox; reuse it exactly so already stored notices retain their receipt and original timestamp.
        var operation = Operation.Create(id, "system:notifications", new { topic, dedupKey }, clock, "notification");
        if (await records.ReadAsync<Notification>(Scope(account), key, ct) is not { } existing)
        {
            try
            {
                await records.CommitAsync(Scope(account), operation,
                    "notification.store", item.Id, [RecordChange.Create(key, "notification", item)], new CommandResult { Id = item.Id, Status = item.Status }, ct);
            }
            catch (DomainException error) when (error.Code == "write_conflict") { /* Only a matching current recipient row can prove this race succeeded. */ }
            catch (DomainException error) when (error.Code == "operation_reused") { throw IdentityConflict(); }
            existing = await records.ReadAsync<Notification>(Scope(account), key, ct)
                ?? throw new DomainException("notification_storage_unconfirmed", "The notification has not been confirmed in its recipient account.", FailureKind.Unavailable);
        }
        if (!Matches(existing.Value, item))
            throw IdentityConflict();
        try
        {
            if ((await records.ReplayAsync<CommandResult>(Scope(account), operation, ct))?.Id != item.Id)
                throw new DomainException("notification_storage_unconfirmed", "The recipient notification receipt has not been confirmed.", FailureKind.Unavailable);
        }
        catch (DomainException error) when (error.Code == "operation_reused") { throw IdentityConflict(); }
    }

    private static Guid Id(string account, string dedupKey)
        => new(SHA256.HashData(Encoding.UTF8.GetBytes(account + "\n" + dedupKey)).AsSpan(0, 16));

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
