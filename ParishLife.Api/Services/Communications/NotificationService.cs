// Purpose: stores in-app notifications for their recipients with deduplication and honours optional-topic preferences.
// Main functions: NotifyAsync (called by other services after their own commit), ListAsync, SetStateAsync, PreferencesAsync and
// SavePreferencesAsync. "Stored" means available in-app; no external delivery or reading is implied.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class NotificationService(IRecordTransactions records, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string account) => new() { Area = RecordArea.Account, OwnerId = account };
    private const string PreferencesKey = "notificationPreferences";

    // Best effort after the producer's committed change: a duplicate event (same key) is stored once, and a storage race is not an error.
    internal async Task NotifyAsync(string account, string? parish, string topic, string title, string? link, bool required, string dedupKey, CancellationToken ct)
    {
        if (!required && (await records.ReadAsync<NotificationPreferences>(Scope(account), PreferencesKey, ct))?.Value.MutedTopics.Contains(topic) == true)
            return;
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(account + "\n" + dedupKey));
        var id = new Guid(hash.AsSpan(0, 16));
        var key = "notification:" + id.ToString("N");
        if (await records.ReadAsync<Notification>(Scope(account), key, ct) is not null)
            return;
        var item = new Notification
        {
            Id = id.ToString("N"), AccountId = account, ParishId = parish, Kind = required ? "Required" : "Optional", Topic = topic, Title = title,
            Link = link, CreatedAt = clock.GetUtcNow()
        };
        try
        {
            await records.CommitAsync(Scope(account), Operation.Create(id, "system:notifications", new { topic, dedupKey }, clock, "notification"),
                "notification.store", item.Id, [RecordChange.Create(key, "notification", item)], new CommandResult { Id = item.Id, Status = item.Status }, ct);
        }
        catch (DomainException error) when (error.Code == "write_conflict") { }
    }

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
