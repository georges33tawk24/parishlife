// Purpose: manages parish announcements with explicit audiences and prayer intentions that stay clergy-private until published within
// the submitter's chosen limit.
// Main functions: SaveAnnouncementAsync, AnnouncementActionAsync, StaffAnnouncementsAsync, PublicAnnouncementsAsync, MemberAnnouncementsAsync,
// SubmitIntentionAsync, DecideIntentionAsync, OwnIntentionsAsync, PriestIntentionsAsync and PublicIntentionsAsync.

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Communications;

public class CommunicationsService(IRecordTransactions records, IParishAccess access, IParishRepository parishes, IClergyAuthority clergy,
    MinistryAccess own, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string AnnouncementKey(string id) => "announcement:" + id;
    private static string IntentionKey(string id) => "prayerIntention:" + id;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested item is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_communication_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> StaffAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        return root;
    }

    private async Task<Versioned<Parish>> PriestAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        return await parishes.GetAsync(parish, ct) ?? throw Missing();
    }

    public async Task<AnnouncementDto> SaveAnnouncementAsync(string parish, string? id, SaveAnnouncementDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, Permissions.CommunicationsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "announcement:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAnnouncementAsync(parish, prior.Id, ct)).Value, true);
        Versioned<Announcement>? old = id is null ? null : await ReadAnnouncementAsync(parish, id, ct);
        if (old is not null && old.Value.Status != "Draft")
            throw State("Published announcements are not edited in place; withdraw and publish a new one.");
        var item = old?.Value ?? new Announcement { Id = op.Id, ParishId = parish, CreatedBy = actor.AccountId, CreatedAt = op.At };
        item.Visibility = request.Visibility is "Public" or "Members" or "Ministry" ? request.Visibility : throw new DomainException("invalid_input", "Use Public, Members or Ministry.");
        item.MinistryId = null;
        if (item.Visibility == "Ministry")
            item.MinistryId = (await own.ReadAsync(parish, Guard.Id(request.MinistryId ?? throw new DomainException("invalid_input", "Choose the ministry audience.")), ct)).Value.Id;
        item.Title = Guard.Text(request.Title, "Title", 300);
        item.Body = Guard.Text(request.Body, "Body", 20000);
        item.Category = string.IsNullOrWhiteSpace(request.Category) ? null : Guard.Text(request.Category, "Category", 100);
        item.Language = request.Language is "en" or "fr" or "ar" ? request.Language : throw new DomainException("invalid_input", "Use en, fr or ar.");
        item.Pinned = request.Pinned;
        item.ExpiresAt = request.ExpiresAt is { } expiry ? Guard.Utc(expiry) : null;
        await records.CommitAsync(Scope(parish), op, "communications.announcement_save", item.Id,
            [Fence(root), old is null ? RecordChange.Create(AnnouncementKey(item.Id), "announcement", item)
                : RecordChange.Replace(AnnouncementKey(item.Id), "announcement", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, true);
    }

    public async Task<AnnouncementDto> AnnouncementActionAsync(string parish, string id, AnnouncementActionDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, Permissions.CommunicationsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "announcement-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAnnouncementAsync(parish, id, ct)).Value, true);
        var item = (await ReadAnnouncementAsync(parish, id, ct)).Value;
        switch (request.Action)
        {
            case "publish" when item.Status == "Draft":
                // Public content is a separate publishing capability, not ordinary member communication.
                if (item.Visibility == "Public")
                    await access.RequireAsync(parish, Permissions.PublishingManage, ct);
                if (item.ExpiresAt is { } expiry && expiry <= op.At)
                    throw State("This announcement has already expired.");
                item.Status = "Published";
                item.PublishedBy = actor.AccountId;
                item.PublishedAt = op.At;
                break;
            case "withdraw" when item.Status == "Published":
                item.WithdrawalReason = Guard.Text(request.Reason, "Withdrawal reason", 2000);
                item.Status = "Withdrawn";
                break;
            default:
                throw State("This announcement action is not available now.");
        }
        await records.CommitAsync(Scope(parish), op, "communications.announcement_" + request.Action, id,
            [Fence(root), RecordChange.Replace(AnnouncementKey(id), "announcement", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item, true);
    }

    public async Task<IReadOnlyList<Versioned<AnnouncementDto>>> StaffAnnouncementsAsync(string parish, CancellationToken ct)
    {
        await StaffAsync(parish, Permissions.CommunicationsManage, ct);
        return (await records.CollectAsync<Announcement>(Scope(parish), "announcement", ct, 2000))
            .OrderByDescending(r => r.Value.CreatedAt).Select(r => new Versioned<AnnouncementDto> { Version = r.Version, Value = Project(r.Value, true) }).ToArray();
    }

    public async Task<IReadOnlyList<AnnouncementDto>> PublicAnnouncementsAsync(string parish, CancellationToken ct)
    {
        await own.RootAsync(parish, ct);
        return await VisibleAsync(parish, a => a.Visibility == "Public", ct);
    }

    // Members see public and member announcements plus those of ministries they currently belong to.
    public async Task<IReadOnlyList<AnnouncementDto>> MemberAnnouncementsAsync(string parish, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        var now = clock.GetUtcNow();
        var memberships = (await records.CollectAsync<MinistryMembership>(Scope(parish), "ministryMembership", ct, 500, Equal("personId", link.Value.PersonId)))
            .Where(m => m.Value.Current(now)).Select(m => m.Value.MinistryId).ToHashSet(StringComparer.Ordinal);
        return await VisibleAsync(parish, a => a.Visibility is "Public" or "Members" || a.Visibility == "Ministry" && a.MinistryId is not null && memberships.Contains(a.MinistryId), ct);
    }

    public async Task<PrayerIntentionDto> SubmitIntentionAsync(string parish, SubmitIntentionDto request, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        await own.RootAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "prayer-intention:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return ProjectIntention((await ReadIntentionAsync(parish, prior.Id, ct)).Value, true);
        if (request.RequestedVisibility is not ("ClergyPrivate" or "AnonymousPublic" or "IdentifiedPublic"))
            throw new DomainException("invalid_input", "Choose ClergyPrivate, AnonymousPublic or IdentifiedPublic.");
        var item = new PrayerIntention
        {
            Id = op.Id, ParishId = parish, ApplicantAccountId = actor.AccountId, Text = Guard.Text(request.Text, "Intention", 2000),
            RequestedVisibility = request.RequestedVisibility, SubmittedAt = op.At,
            DisplayName = request.RequestedVisibility == "IdentifiedPublic" ? Guard.Text(request.DisplayName, "Name to publish", 200) : null
        };
        await records.CommitAsync(Scope(parish), op, "communications.intention_submit", item.Id, [RecordChange.Create(IntentionKey(item.Id), "prayerIntention", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return ProjectIntention(item, true);
    }

    public async Task<PrayerIntentionDto> DecideIntentionAsync(string parish, string id, IntentionDecisionDto request, CancellationToken ct)
    {
        var root = await PriestAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "prayer-intention-decision:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return ProjectIntention((await ReadIntentionAsync(parish, id, ct)).Value, true);
        var item = (await ReadIntentionAsync(parish, id, ct)).Value;
        if (item.Status != "Received")
            throw State("This intention has already been decided.");
        // Publication never exceeds what the submitter allowed: private stays private, anonymous never gains a name.
        item.Status = request.Decision switch
        {
            "publish-anonymous" when item.RequestedVisibility is "AnonymousPublic" or "IdentifiedPublic" => "PublishedAnonymous",
            "publish-identified" when item.RequestedVisibility == "IdentifiedPublic" => "PublishedIdentified",
            "keep-private" => "KeptPrivate",
            "decline" => "Declined",
            _ => throw State("The submitter did not allow that use of this intention.")
        };
        item.DecidedBy = actor.AccountId;
        item.DecidedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "communications.intention_" + request.Decision.Replace('-', '_'), id,
            [Fence(root), RecordChange.Replace(IntentionKey(id), "prayerIntention", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return ProjectIntention(item, true);
    }

    public async Task<IReadOnlyList<PrayerIntentionDto>> OwnIntentionsAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        return (await records.CollectAsync<PrayerIntention>(Scope(parish), "prayerIntention", ct, 500, Equal("applicantAccountId", actor.AccountId)))
            .Select(r => ProjectIntention(r.Value, true)).ToArray();
    }

    // Clergy-private intentions are read only by current priests, not by general office staff.
    public async Task<IReadOnlyList<Versioned<PrayerIntentionDto>>> PriestIntentionsAsync(string parish, CancellationToken ct)
    {
        await PriestAsync(parish, ct);
        return (await records.CollectAsync<PrayerIntention>(Scope(parish), "prayerIntention", ct, 2000))
            .OrderByDescending(r => r.Value.SubmittedAt).Select(r => new Versioned<PrayerIntentionDto> { Version = r.Version, Value = ProjectIntention(r.Value, true) }).ToArray();
    }

    public async Task<IReadOnlyList<PrayerIntentionDto>> PublicIntentionsAsync(string parish, CancellationToken ct)
    {
        await own.RootAsync(parish, ct);
        return (await records.CollectAsync<PrayerIntention>(Scope(parish), "prayerIntention", ct, 2000))
            .Where(r => r.Value.Status is "PublishedAnonymous" or "PublishedIdentified").OrderByDescending(r => r.Value.DecidedAt)
            .Select(r => ProjectIntention(r.Value, false)).ToArray();
    }

    private async Task<IReadOnlyList<AnnouncementDto>> VisibleAsync(string parish, Func<Announcement, bool> audience, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return (await records.CollectAsync<Announcement>(Scope(parish), "announcement", ct, 2000, Equal("status", "Published")))
            .Select(r => r.Value).Where(a => (a.ExpiresAt is null || a.ExpiresAt > now) && audience(a))
            .OrderByDescending(a => a.Pinned).ThenByDescending(a => a.PublishedAt).Select(a => Project(a, false)).ToArray();
    }

    private async Task<Versioned<Announcement>> ReadAnnouncementAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<Announcement>(Scope(parish), AnnouncementKey(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private async Task<Versioned<PrayerIntention>> ReadIntentionAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<PrayerIntention>(Scope(parish), IntentionKey(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static AnnouncementDto Project(Announcement x, bool staff) => new()
    {
        Id = x.Id, Visibility = x.Visibility, MinistryId = x.MinistryId, Title = x.Title, Body = x.Body, Category = x.Category, Language = x.Language,
        Pinned = x.Pinned, ExpiresAt = x.ExpiresAt, Status = x.Status, PublishedAt = x.PublishedAt, PublishedBy = staff ? x.PublishedBy : null
    };

    private static PrayerIntentionDto ProjectIntention(PrayerIntention x, bool full) => new()
    {
        Id = x.Id, Text = x.Text, DisplayName = full || x.Status == "PublishedIdentified" ? x.DisplayName : null,
        RequestedVisibility = full ? x.RequestedVisibility : null, Status = x.Status, SubmittedAt = x.SubmittedAt
    };
}
