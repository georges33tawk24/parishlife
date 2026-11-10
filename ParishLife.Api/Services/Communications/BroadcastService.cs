// Purpose: runs parish broadcasts and templates (N05, proposed S26.09–S26.15/P26). Communications staff draft; a different staff member approves the
// exact version; sending resolves the audience at that moment (active linked parishioners or current ministry members with active verified
// accounts, minus optional-topic opt-outs) and stores one in-app copy for exactly those recipients. External channels have no provider, so
// they are reported NotConfigured and never as sent.
// Main functions: SaveTemplateAsync, TemplateActionAsync, TemplatesAsync, SaveAsync, ActionAsync, ListAsync, PreviewAsync and MineAsync;
// helpers StaffAsync and ResolveAsync.

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Communications;

public class BroadcastService(IRecordTransactions records, IParishAccess access, IAccountDirectory accounts, MinistryAccess own, ICurrentActor actor,
    MfaAccountAccess proof, TimeProvider clock)
{
    internal const string Topic = "parish.broadcast";
    // A technical bound for one stored broadcast document, not an agreed audience limit.
    internal const int MaximumRecipients = 2000;
    private static readonly string[] ExternalChannels = ["Email", "Sms", "Push"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordScope Account(string account) => new() { Area = RecordArea.Account, OwnerId = account };
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    private static DomainException Missing() => new("resource_not_found", "The requested item is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_broadcast_state", message, FailureKind.Conflict);
    private static DomainException SameReviewer() => new("independent_approval_required", "A different staff member must approve this.", FailureKind.Forbidden);

    private async Task<Versioned<Parish>> StaffAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.CommunicationsManage, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        return root;
    }

    public async Task<BroadcastTemplateDto> SaveTemplateAsync(string parish, string? id, SaveBroadcastTemplateDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "broadcast-template:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync<BroadcastTemplate>(parish, "broadcastTemplate", prior.Id, t => t.ParishId, t => t.Id, ct)).Value);
        var old = id is null ? null : await ReadAsync<BroadcastTemplate>(parish, "broadcastTemplate", id, t => t.ParishId, t => t.Id, ct);
        if (old is not null && old.Value.Status != "Draft")
            throw State("Approved or retired templates are not edited; create a new template.");
        var item = old?.Value ?? new BroadcastTemplate { Id = op.Id, ParishId = parish };
        item.Name = Guard.Text(request.Name, "Name", 200);
        item.Title = Guard.Text(request.Title, "Title", 300);
        item.Body = Guard.Text(request.Body, "Body", 20000);
        item.Language = Language(request.Language);
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "communications.template_save", item.Id,
            [Fence(root), old is null ? RecordChange.Create("broadcastTemplate:" + item.Id, "broadcastTemplate", item)
                : RecordChange.Replace("broadcastTemplate:" + item.Id, "broadcastTemplate", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<BroadcastTemplateDto> TemplateActionAsync(string parish, string id, BroadcastActionDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "broadcast-template-action:v1:" + id);
        var row = await ReadAsync<BroadcastTemplate>(parish, "broadcastTemplate", id, t => t.ParishId, t => t.Id, ct);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(row.Value);
        var item = row.Value;
        switch (request.Action)
        {
            case "approve" when item.Status == "Draft":
                if (item.UpdatedBy == actor.AccountId) throw SameReviewer();
                item.Status = "Approved";
                item.ApprovedBy = actor.AccountId;
                item.ApprovedAt = op.At;
                break;
            case "retire" when item.Status is "Draft" or "Approved":
                item.Status = "Retired";
                break;
            default:
                throw State("This template action is not available now.");
        }
        await records.CommitAsync(Scope(parish), op, "communications.template_" + request.Action, id,
            [Fence(root), RecordChange.Replace("broadcastTemplate:" + id, "broadcastTemplate", item, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<IReadOnlyList<Versioned<BroadcastTemplateDto>>> TemplatesAsync(string parish, CancellationToken ct)
    {
        await StaffAsync(parish, ct);
        return (await records.CollectAsync<BroadcastTemplate>(Scope(parish), "broadcastTemplate", ct, 500))
            .OrderBy(r => r.Value.Name, StringComparer.Ordinal).Select(r => new Versioned<BroadcastTemplateDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    public async Task<BroadcastDto> SaveAsync(string parish, string? id, SaveBroadcastDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "broadcast:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadBroadcastAsync(parish, prior.Id, ct)).Value);
        var old = id is null ? null : await ReadBroadcastAsync(parish, id, ct);
        if (old is not null && old.Value.Status != "Draft")
            throw State("Only a draft broadcast can be edited; cancel it and draft a new one.");
        var item = old?.Value ?? new Broadcast { Id = op.Id, ParishId = parish };
        item.Audience = request.Audience is "Members" or "Ministry" ? request.Audience : throw new DomainException("invalid_input", "Use Members or Ministry.");
        item.MinistryId = item.Audience == "Ministry"
            ? (await own.ReadAsync(parish, Guard.Id(request.MinistryId ?? throw new DomainException("invalid_input", "Choose the ministry audience.")), ct)).Value.Id
            : null;
        if (request.TemplateId is { } templateId)
        {
            var template = (await ReadAsync<BroadcastTemplate>(parish, "broadcastTemplate", Guard.Id(templateId), t => t.ParishId, t => t.Id, ct)).Value;
            if (template.Status != "Approved") throw State("Only an approved template can be used.");
            item.TemplateId = template.Id;
            item.Title = template.Title;
            item.Body = template.Body;
            item.Language = template.Language;
        }
        else
        {
            item.TemplateId = null;
            item.Title = Guard.Text(request.Title, "Title", 300);
            item.Body = Guard.Text(request.Body, "Body", 20000);
            item.Language = Language(request.Language);
        }
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "communications.broadcast_save", item.Id,
            [Fence(root), old is null ? RecordChange.Create("broadcast:" + item.Id, "broadcast", item)
                : RecordChange.Replace("broadcast:" + item.Id, "broadcast", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<BroadcastDto> ActionAsync(string parish, string id, BroadcastActionDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "broadcast-action:v1:" + id);
        var row = await ReadBroadcastAsync(parish, id, ct);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(row.Value);
        var item = row.Value;
        switch (request.Action)
        {
            // Approval pins the exact reviewed version: approved broadcasts cannot be edited, and a stale version is refused.
            case "approve" when item.Status == "Draft":
                if (item.UpdatedBy == actor.AccountId) throw SameReviewer();
                item.Status = "Approved";
                item.ApprovedBy = actor.AccountId;
                item.ApprovedAt = op.At;
                break;
            case "send" when item.Status == "Approved":
                var (recipients, skipped) = await ResolveAsync(parish, item, ct);
                item.RecipientAccountIds = recipients;
                item.SkippedByPreference = skipped;
                item.Status = "Sent";
                item.SentBy = actor.AccountId;
                item.SentAt = op.At;
                break;
            case "cancel" when item.Status is "Draft" or "Approved":
                item.CancelReason = Guard.Text(request.Reason, "Reason", 2000);
                item.Status = "Cancelled";
                break;
            default:
                throw State("This broadcast action is not available now.");
        }
        await records.CommitAsync(Scope(parish), op, "communications.broadcast_" + request.Action, id,
            [Fence(root), RecordChange.Replace("broadcast:" + id, "broadcast", item, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = item.Status }, ct, item.CancelReason);
        return Project(item);
    }

    public async Task<IReadOnlyList<Versioned<BroadcastDto>>> ListAsync(string parish, CancellationToken ct)
    {
        await StaffAsync(parish, ct);
        return (await records.CollectAsync<Broadcast>(Scope(parish), "broadcast", ct, 500))
            .OrderByDescending(r => r.Value.UpdatedAt).Select(r => new Versioned<BroadcastDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    public async Task<BroadcastAudiencePreviewDto> PreviewAsync(string parish, string id, CancellationToken ct)
    {
        await StaffAsync(parish, ct);
        var (recipients, skipped) = await ResolveAsync(parish, (await ReadBroadcastAsync(parish, id, ct)).Value, ct);
        return new BroadcastAudiencePreviewDto { EligibleCount = recipients.Count, SkippedByPreferenceCount = skipped };
    }

    // ponytail: scans at most 500 sent broadcasts in memory; index recipients if a parish ever sends more.
    public async Task<IReadOnlyList<ReceivedBroadcastDto>> MineAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        await own.RootAsync(parish, ct);
        return (await records.CollectAsync<Broadcast>(Scope(parish), "broadcast", ct, 500, Equal("status", "Sent")))
            .Select(r => r.Value).Where(b => b.RecipientAccountIds.Contains(actor.AccountId, StringComparer.Ordinal))
            .OrderByDescending(b => b.SentAt)
            .Select(b => new ReceivedBroadcastDto { Id = b.Id, Title = b.Title, Body = b.Body, Language = b.Language, SentAt = b.SentAt }).ToArray();
    }

    // Current facts only: active parish links (and current ministry membership), active verified accounts, and the optional-topic opt-out.
    // ponytail: up to two point reads per candidate; a resumable fan-out job is needed beyond MaximumRecipients.
    private async Task<(List<string> Recipients, int Skipped)> ResolveAsync(string parish, Broadcast item, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var links = (await records.CollectAsync<PersonAccountLink>(Scope(parish), "personAccountLink", ct, 5000))
            .Select(r => r.Value).Where(l => l.Active && l.ParishId == parish);
        if (item.Audience == "Ministry")
        {
            var people = (await records.CollectAsync<MinistryMembership>(Scope(parish), "ministryMembership", ct, 5000, Equal("ministryId", item.MinistryId!)))
                .Where(m => m.Value.Current(now)).Select(m => m.Value.PersonId).ToHashSet(StringComparer.Ordinal);
            links = links.Where(l => people.Contains(l.PersonId));
        }
        var candidates = links.Select(l => l.AccountId).Distinct(StringComparer.Ordinal).ToList();
        if (candidates.Count > MaximumRecipients)
            throw new DomainException("batch_limit", "This audience is larger than one broadcast can hold; narrow it to a ministry.", FailureKind.Conflict);
        var recipients = new List<string>();
        var skipped = 0;
        foreach (var account in candidates)
        {
            if (!await accounts.IsActiveVerifiedAsync(account, ct)) continue;
            var preferences = await records.ReadAsync<NotificationPreferences>(Account(account), "notificationPreferences", ct);
            if (preferences?.Value.MutedTopics.Contains(Topic, StringComparer.Ordinal) == true) skipped++;
            else recipients.Add(account);
        }
        return (recipients, skipped);
    }

    private static string Language(string? value) => value is "en" or "fr" or "ar" ? value : throw new DomainException("invalid_input", "Use en, fr or ar.");

    private async Task<Versioned<T>> ReadAsync<T>(string parish, string type, string id, Func<T, string> parishOf, Func<T, string> idOf, CancellationToken ct)
        => await records.ReadAsync<T>(Scope(parish), type + ":" + id, ct) is { } row && parishOf(row.Value) == parish && idOf(row.Value) == id ? row : throw Missing();

    private Task<Versioned<Broadcast>> ReadBroadcastAsync(string parish, string id, CancellationToken ct)
        => ReadAsync<Broadcast>(parish, "broadcast", id, b => b.ParishId, b => b.Id, ct);

    private static BroadcastTemplateDto Project(BroadcastTemplate x) => new()
    {
        Id = x.Id, Name = x.Name, Title = x.Title, Body = x.Body, Language = x.Language, Status = x.Status, UpdatedBy = x.UpdatedBy, UpdatedAt = x.UpdatedAt,
        ApprovedBy = x.ApprovedBy, ApprovedAt = x.ApprovedAt
    };

    private static BroadcastDto Project(Broadcast x) => new()
    {
        Id = x.Id, Audience = x.Audience, MinistryId = x.MinistryId, Title = x.Title, Body = x.Body, Language = x.Language, TemplateId = x.TemplateId,
        Status = x.Status, UpdatedBy = x.UpdatedBy, ApprovedBy = x.ApprovedBy, ApprovedAt = x.ApprovedAt, SentBy = x.SentBy, SentAt = x.SentAt,
        CancelReason = x.CancelReason, RecipientCount = x.RecipientAccountIds.Count, SkippedByPreferenceCount = x.SkippedByPreference,
        // "Stored" is the S26.10 in-app meaning: saved for the intended recipient, not read. No external provider exists, so nothing claims sent.
        Channels = [new BroadcastChannelDto { Channel = "InApp", Status = x.Status == "Sent" ? "Stored" : "NotSent" },
            .. ExternalChannels.Select(c => new BroadcastChannelDto { Channel = c, Status = "NotConfigured" })]
    };
}
