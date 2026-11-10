// Purpose: runs parish website sections: editors save drafts (the live revision stays online), submit complete EN/FR/AR revisions, and an
// appointed priest other than the author returns or publishes them; unpublishing is explicit with a reason. Visitors read only published text.
// Main functions: SaveDraftAsync, ActAsync, SectionsAsync and PublicAsync.

using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Publishing;

public class WebsiteService(IRecordTransactions records, IParishAccess access, IClergyAuthority clergy, MinistryAccess own, ICurrentActor actor,
    MfaAccountAccess proof, TimeProvider clock)
{
    private static readonly string[] Languages = ["en", "fr", "ar"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException Missing() => new("resource_not_found", "The requested website content is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_website_state", message, FailureKind.Conflict);

    private async Task<Versioned<Parish>> EditorAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.PublishingManage, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        return root;
    }

    private static string Section(string key)
        => key.Length is >= 2 and <= 40 && key.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c == '-') ? key
            : throw new DomainException("invalid_input", "Use a short lowercase section key such as about or visiting-hours.");

    public async Task<WebsiteSectionDto> SaveDraftAsync(string parish, string key, SaveWebsiteDraftDto request, CancellationToken ct)
    {
        var root = await EditorAsync(parish, ct);
        key = Section(key);
        var op = actor.CreateOperation(request.OperationId, request, clock, "website-draft:v1:" + key);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await SectionAsync(parish, key, ct);
        if (request.Texts is null || request.Texts.Count == 0 || request.Texts.Keys.Any(l => !Languages.Contains(l)))
            throw new DomainException("invalid_input", "Give the section text in en, fr and/or ar.");
        var texts = request.Texts.ToDictionary(t => t.Key, t => new WebsiteText { Title = Guard.Text(t.Value.Title, "Title", 200), Body = Guard.Text(t.Value.Body, "Body", 20000) });
        // Only one revision is worked on at a time; saving a draft never touches the live one.
        var pending = (await RevisionsAsync(parish, key, ct)).FirstOrDefault(r => r.Value.Status is "Draft" or "Returned" or "AwaitingReview");
        if (pending?.Value.Status == "AwaitingReview")
            throw State("A revision is waiting for review; wait for it to be returned before editing.");
        var section = await records.ReadAsync<WebsiteSection>(Scope(parish), "websiteSection:" + key, ct);
        var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", root.Value, root.Version) };
        WebsiteRevision item;
        if (pending is null)
        {
            item = new WebsiteRevision { Id = op.Id, ParishId = parish, SectionKey = key, Texts = texts, CreatedBy = actor.AccountId, CreatedAt = op.At };
            changes.Add(RecordChange.Create("websiteRevision:" + item.Id, "websiteRevision", item));
        }
        else
        {
            item = pending.Value;
            item.Texts = texts;
            item.Status = "Draft";
            item.CreatedBy = actor.AccountId;
            item.ReturnReason = null;
            changes.Add(RecordChange.Replace("websiteRevision:" + item.Id, "websiteRevision", item, Versions.Require(request.Version)));
        }
        if (section is null)
            changes.Add(RecordChange.Create("websiteSection:" + key, "websiteSection", new WebsiteSection { Key = key, ParishId = parish, UpdatedAt = op.At }));
        await records.CommitAsync(Scope(parish), op, "website.draft", key, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await SectionAsync(parish, key, ct);
    }

    public async Task<WebsiteSectionDto> ActAsync(string parish, string key, string revisionId, WebsiteActionDto request, CancellationToken ct)
    {
        var root = await EditorAsync(parish, ct);
        key = Section(key);
        if (request.Action is "return" or "publish" or "unpublish")
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "website-action:v1:" + key);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await SectionAsync(parish, key, ct);
        var sectionRow = await records.ReadAsync<WebsiteSection>(Scope(parish), "websiteSection:" + key, ct) ?? throw Missing();
        var section = sectionRow.Value;
        var row = await ReadRevisionAsync(parish, revisionId, ct);
        var item = row.Value;
        if (item.SectionKey != key)
            throw Missing();
        var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", root.Value, root.Version) };
        switch (request.Action)
        {
            case "submit" when item.Status is "Draft" or "Returned":
                if (Missing(item).Length > 0)
                    throw State("Complete the English, French and Arabic versions before review.");
                item.Status = "AwaitingReview";
                break;
            case "return" when item.Status == "AwaitingReview":
                item.Status = "Returned";
                item.ReturnReason = Guard.Text(request.Reason, "Reason", 1000);
                item.ReviewedBy = actor.AccountId;
                item.ReviewedAt = op.At;
                break;
            case "publish" when item.Status == "AwaitingReview":
                if (item.CreatedBy == actor.AccountId)
                    throw State("A priest other than the author publishes this revision.");
                if (section.PublishedRevisionId is { } live && live != item.Id)
                {
                    var old = await ReadRevisionAsync(parish, live, ct);
                    old.Value.Status = "Superseded";
                    changes.Add(RecordChange.Replace("websiteRevision:" + live, "websiteRevision", old.Value, old.Version));
                }
                item.Status = "Published";
                item.ReviewedBy = actor.AccountId;
                item.ReviewedAt = op.At;
                item.PublishedAt = op.At;
                section.PublishedRevisionId = item.Id;
                section.Status = "Published";
                section.UnpublishReason = null;
                break;
            case "unpublish" when item.Status == "Published" && section.PublishedRevisionId == item.Id:
                item.Status = "Superseded";
                section.PublishedRevisionId = null;
                section.Status = "Unpublished";
                section.UnpublishReason = Guard.Text(request.Reason, "Reason", 1000);
                break;
            default:
                throw State("That action is not available for a " + item.Status + " revision.");
        }
        section.UpdatedAt = op.At;
        changes.Add(RecordChange.Replace("websiteRevision:" + item.Id, "websiteRevision", item, Versions.Require(request.Version)));
        changes.Add(RecordChange.Replace("websiteSection:" + key, "websiteSection", section, sectionRow.Version));
        await records.CommitAsync(Scope(parish), op, "website." + request.Action, key, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await SectionAsync(parish, key, ct);
    }

    public async Task<IReadOnlyList<Versioned<WebsiteSectionDto>>> SectionsAsync(string parish, CancellationToken ct)
    {
        await EditorAsync(parish, ct);
        var result = new List<Versioned<WebsiteSectionDto>>();
        foreach (var row in await records.CollectAsync<WebsiteSection>(Scope(parish), "websiteSection", ct, 200))
            result.Add(new Versioned<WebsiteSectionDto> { Version = row.Version, Value = await SectionAsync(parish, row.Value.Key, ct) });
        return result.OrderBy(s => s.Value.Key, StringComparer.Ordinal).ToArray();
    }

    public async Task<IReadOnlyList<PublicWebsiteSectionDto>> PublicAsync(string parish, string? language, CancellationToken ct)
    {
        await own.RootAsync(parish, ct);
        var lang = language is null ? "en" : Languages.Contains(language) ? language : throw new DomainException("invalid_input", "Choose en, fr or ar.");
        var result = new List<PublicWebsiteSectionDto>();
        foreach (var section in await records.CollectAsync<WebsiteSection>(Scope(parish), "websiteSection", ct, 200, new RecordCondition { Path = "status", Comparison = "eq", Value = "Published" }))
            if (section.Value.PublishedRevisionId is { } live && (await records.ReadAsync<WebsiteRevision>(Scope(parish), "websiteRevision:" + live, ct))?.Value is { } revision
                && revision.Texts.TryGetValue(lang, out var text))
                result.Add(new PublicWebsiteSectionDto { Key = section.Value.Key, Language = lang, Title = text.Title, Body = text.Body, PublishedAt = revision.PublishedAt });
        return result.OrderBy(s => s.Key, StringComparer.Ordinal).ToArray();
    }

    private async Task<WebsiteSectionDto> SectionAsync(string parish, string key, CancellationToken ct)
    {
        var section = (await records.ReadAsync<WebsiteSection>(Scope(parish), "websiteSection:" + key, ct))?.Value ?? throw Missing();
        var revisions = await RevisionsAsync(parish, key, ct);
        return new WebsiteSectionDto
        {
            Key = key, Status = section.Status, UnpublishReason = section.UnpublishReason,
            Published = revisions.FirstOrDefault(r => r.Value.Id == section.PublishedRevisionId) is { } live ? Project(live) : null,
            Pending = revisions.FirstOrDefault(r => r.Value.Status is "Draft" or "Returned" or "AwaitingReview") is { } pending ? Project(pending) : null
        };
    }

    // ponytail: filters a parish's revisions in memory (cap 2000); index sectionKey if sites grow large.
    private async Task<List<Versioned<WebsiteRevision>>> RevisionsAsync(string parish, string key, CancellationToken ct)
        => (await records.CollectAsync<WebsiteRevision>(Scope(parish), "websiteRevision", ct, 2000)).Where(r => r.Value.SectionKey == key).ToList();

    private async Task<Versioned<WebsiteRevision>> ReadRevisionAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<WebsiteRevision>(Scope(parish), "websiteRevision:" + id, ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    private static string[] Missing(WebsiteRevision x) => Languages.Where(l => !x.Texts.ContainsKey(l)).ToArray();

    private static WebsiteRevisionDto Project(Versioned<WebsiteRevision> row) => Project(row.Value, row.Version);

    private static WebsiteRevisionDto Project(WebsiteRevision x, string version) => new()
    {
        Id = x.Id, Version = version, SectionKey = x.SectionKey, Texts = x.Texts.ToDictionary(t => t.Key, t => new WebsiteTextDto { Title = t.Value.Title, Body = t.Value.Body }),
        MissingLanguages = Missing(x), Status = x.Status, CreatedBy = x.CreatedBy, CreatedAt = x.CreatedAt, ReviewedBy = x.ReviewedBy, ReviewedAt = x.ReviewedAt,
        ReturnReason = x.ReturnReason, PublishedAt = x.PublishedAt
    };
}
