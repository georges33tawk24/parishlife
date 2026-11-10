// Purpose: runs the platform homepage: one working draft, publication of exactly the reviewed draft version, immutable revision history
// and the public projection of the live revision. Editing and publishing are limited to current MFA platform operators.
// Main functions: GetDraftAsync, SaveDraftAsync, PublishAsync, HistoryAsync and PublicAsync; helpers validate plain text, safe links, section order and
// EN/FR/AR readiness. Drafts never change the live page; publishing needs every ordered block complete in all three languages.

using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Publishing;

public class HomepageService(IRecordTransactions records, IPlatformAccess platform, MfaAccountAccess proof, ICurrentActor actor, TimeProvider clock)
{
    internal static readonly string[] Languages = ["en", "fr", "ar"];
    internal static readonly string[] Sections = ["hero", "announcement", "stories", "about", "join"];
    // A technical bound that protects payload size; it is not an agreed product maximum.
    internal const int MaximumStories = 50;
    private static readonly RecordScope Scope = new() { Area = RecordArea.Platform, OwnerId = "site-content" };
    private static DomainException Missing() => new("resource_not_found", "The requested homepage content is unavailable.", FailureKind.NotFound);
    private static DomainException Invalid(string message) => new("invalid_input", message);

    private async Task RequireAsync(CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await platform.RequireOperatorAsync(ct);
    }

    public async Task<Versioned<HomepageDraftDto>> GetDraftAsync(CancellationToken ct)
    {
        await RequireAsync(ct);
        var row = await records.ReadAsync<HomepageDraft>(Scope, "draft", ct) ?? throw Missing();
        return new Versioned<HomepageDraftDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<Versioned<HomepageDraftDto>> SaveDraftAsync(SaveHomepageDraftDto request, CancellationToken ct)
    {
        await RequireAsync(ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "homepage-draft:v1");
        if (await records.ReplayAsync<CommandResult>(Scope, op, ct) is not null)
            return await GetDraftAsync(ct);
        var previous = await records.ReadAsync<HomepageDraft>(Scope, "draft", ct);
        if (previous is null && request.Version is not null || previous is not null && previous.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The homepage draft changed; reload it before saving.", FailureKind.Conflict);
        var draft = new HomepageDraft { Content = Validate(request.Content), UpdatedBy = actor.AccountId, UpdatedAt = op.At };
        await RequireAsync(ct);
        await records.CommitAsync(Scope, op, "homepage.draft", "draft",
            [previous is null ? RecordChange.Create("draft", "homepageDraft", draft) : RecordChange.Replace("draft", "homepageDraft", draft, previous.Version)],
            new CommandResult { Id = "draft", Status = "Saved" }, ct);
        return await GetDraftAsync(ct);
    }

    public async Task<HomepageRevisionDto> PublishAsync(PublishHomepageDto request, CancellationToken ct)
    {
        await RequireAsync(ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "homepage-publish:v1");
        if (await records.ReplayAsync<CommandResult>(Scope, op, ct) is { } prior)
            return Project((await records.ReadAsync<HomepageRevision>(Scope, "homepageRevision:" + prior.Id, ct) ?? throw Missing()).Value);
        var draft = await records.ReadAsync<HomepageDraft>(Scope, "draft", ct) ?? throw Missing();
        if (draft.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The homepage draft changed after it was reviewed; reload it before publishing.", FailureKind.Conflict);
        var incomplete = Readiness(draft.Value.Content).Where(r => !r.Complete).Select(r => r.Language).ToArray();
        if (draft.Value.Content.Order.Length == 0 || incomplete.Length > 0)
            throw new DomainException("homepage_translation_incomplete",
                draft.Value.Content.Order.Length == 0 ? "Choose at least one section to publish."
                    : "Complete every published block in English, French and Arabic first; incomplete: " + string.Join(", ", incomplete) + ".", FailureKind.Conflict);

        var revision = new HomepageRevision
        {
            Id = op.Id, Status = "Published", Content = draft.Value.Content, DraftVersion = draft.Version, PublishedBy = actor.AccountId, PublishedAt = op.At,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Reason", 500)
        };
        var changes = new List<RecordChange> { RecordChange.Create("homepageRevision:" + revision.Id, "homepageRevision", revision) };
        var live = await records.ReadAsync<HomepageRevision>(Scope, "published", ct);
        if (live is null)
            changes.Add(RecordChange.Create("published", "homepagePublished", revision));
        else
        {
            changes.Add(RecordChange.Replace("published", "homepagePublished", revision, live.Version));
            var old = await records.ReadAsync<HomepageRevision>(Scope, "homepageRevision:" + live.Value.Id, ct) ?? throw Missing();
            old.Value.Status = "Superseded";
            changes.Add(RecordChange.Replace("homepageRevision:" + old.Value.Id, "homepageRevision", old.Value, old.Version));
        }
        await RequireAsync(ct);
        await records.CommitAsync(Scope, op, "homepage.publish", revision.Id, changes, new CommandResult { Id = revision.Id, Status = "Published" }, ct);
        return Project(revision);
    }

    public async Task<Page<HomepageRevisionDto>> HistoryAsync(int size, string? cursor, CancellationToken ct)
    {
        await RequireAsync(ct);
        var page = await records.PageAsync<HomepageRevision>(Scope, "homepageRevision", size, cursor, ct);
        return new Page<HomepageRevisionDto> { Items = page.Items.Select(row => Project(row.Value)).OrderByDescending(r => r.PublishedAt).ToArray(), ContinuationToken = page.ContinuationToken };
    }

    // Visitors read only the live revision, in their language (English when the requested one is unsupported), with no editor information.
    public async Task<PublicHomepageDto> PublicAsync(string? language, CancellationToken ct)
    {
        var live = await records.ReadAsync<HomepageRevision>(Scope, "published", ct) ?? throw Missing();
        var lang = Languages.Contains(language) ? language! : "en";
        var content = live.Value.Content;
        var blocks = new List<PublicHomepageBlockDto>();
        foreach (var section in content.Order)
            foreach (var block in BlocksOf(content, section))
                if (Pick(block, lang) is { } view)
                    blocks.Add(new PublicHomepageBlockDto
                    {
                        Section = section, Id = block.Id, Language = view.Language, Title = view.Text.Title, Body = view.Text.Body,
                        LinkLabel = view.Text.LinkLabel, LinkUrl = block.LinkUrl
                    });
        return new PublicHomepageDto { Language = lang, PublishedAt = live.Value.PublishedAt, Blocks = [.. blocks] };
    }

    private static (string Language, HomepageText Text)? Pick(HomepageBlock block, string lang)
    {
        foreach (var candidate in new[] { lang, "en" })
            if (block.Texts.TryGetValue(candidate, out var text) && !string.IsNullOrWhiteSpace(text.Title) && !string.IsNullOrWhiteSpace(text.Body))
                return (candidate, text);
        return null;
    }

    private static IEnumerable<HomepageBlock> BlocksOf(HomepageContent content, string section) => section switch
    {
        "hero" => content.Hero is null ? [] : [content.Hero],
        "announcement" => content.Announcement is null ? [] : [content.Announcement],
        "about" => content.About is null ? [] : [content.About],
        "join" => content.Join is null ? [] : [content.Join],
        "stories" => content.Stories,
        _ => []
    };

    internal static HomepageReadinessDto[] Readiness(HomepageContent content)
        => Languages.Select(language =>
        {
            var missing = new List<string>();
            foreach (var section in content.Order)
            {
                var blocks = BlocksOf(content, section).ToArray();
                if (blocks.Length == 0 && section != "stories")
                    missing.Add(section);
                foreach (var block in blocks)
                {
                    var name = section == "stories" ? "stories:" + block.Id : section;
                    block.Texts.TryGetValue(language, out var text);
                    if (string.IsNullOrWhiteSpace(text?.Title)) missing.Add(name + ".title");
                    if (string.IsNullOrWhiteSpace(text?.Body)) missing.Add(name + ".body");
                }
            }
            return new HomepageReadinessDto { Language = language, Complete = missing.Count == 0, Missing = [.. missing] };
        }).ToArray();

    private static HomepageContent Validate(HomepageContentDto dto)
    {
        if (dto.Order.Length != dto.Order.Distinct(StringComparer.Ordinal).Count() || dto.Order.Any(s => !Sections.Contains(s)))
            throw Invalid("Order may list each of hero, announcement, stories, about and join at most once.");
        if (dto.Stories.Count > MaximumStories)
            throw Invalid("A homepage holds at most " + MaximumStories + " stories.");
        var stories = dto.Stories.Select(story => Block(story, story.Id)).ToList();
        if (stories.Any(s => s.Id.Length is < 2 or > 40 || !s.Id.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c == '-'))
            || stories.Select(s => s.Id).Distinct(StringComparer.Ordinal).Count() != stories.Count)
            throw Invalid("Give each story a unique short lowercase key such as spring-pilgrimage.");
        return new HomepageContent
        {
            Order = [.. dto.Order], Hero = dto.Hero is null ? null : Block(dto.Hero, "hero"), Announcement = dto.Announcement is null ? null : Block(dto.Announcement, "announcement"),
            About = dto.About is null ? null : Block(dto.About, "about"), Join = dto.Join is null ? null : Block(dto.Join, "join"), Stories = stories
        };
    }

    private static HomepageBlock Block(HomepageBlockDto dto, string id)
    {
        if (dto.Texts is null || dto.Texts.Keys.Any(language => !Languages.Contains(language)))
            throw Invalid("Give homepage text in en, fr and/or ar only.");
        return new HomepageBlock
        {
            Id = id?.Trim() ?? string.Empty, LinkUrl = string.IsNullOrWhiteSpace(dto.LinkUrl) ? null : Link(dto.LinkUrl),
            Texts = dto.Texts.ToDictionary(t => t.Key, t => new HomepageText
            {
                Title = Plain(t.Value?.Title, "Title", 200), Body = Plain(t.Value?.Body, "Body", 5000),
                LinkLabel = string.IsNullOrWhiteSpace(t.Value?.LinkLabel) ? null : Plain(t.Value.LinkLabel, "Link label", 80)
            })
        };
    }

    // Plain text only: trimmed, bounded and free of control characters other than line breaks and tabs. Markup is never interpreted.
    private static string Plain(string? value, string name, int maximum)
    {
        var text = (value ?? string.Empty).Trim();
        if (text.Length > maximum || text.Any(c => char.IsControl(c) && c is not ('\n' or '\r' or '\t')))
            throw Invalid($"{name} must be plain text of at most {maximum} characters.");
        return text;
    }

    // A link is an absolute https address without credentials, or a path on this site; nothing else (no javascript:, data:, mailto: or http:).
    internal static string Link(string value)
    {
        var url = value.Trim();
        if (url.Length > 500 || url.Any(c => char.IsControl(c) || char.IsWhiteSpace(c) || c == '\\'))
            throw Invalid("Use a short link without spaces or control characters.");
        if (url.StartsWith('/') && !url.StartsWith("//", StringComparison.Ordinal))
            return url;
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && uri.Host.Length > 0 && uri.UserInfo.Length == 0)
            return url;
        throw Invalid("Links must be https addresses or paths on this site.");
    }

    private static HomepageDraftDto Project(HomepageDraft draft) => new()
    {
        Content = Project(draft.Content), Readiness = Readiness(draft.Content), UpdatedBy = draft.UpdatedBy, UpdatedAt = draft.UpdatedAt
    };

    private static HomepageRevisionDto Project(HomepageRevision item) => new()
    {
        Id = item.Id, Status = item.Status, PublishedBy = item.PublishedBy, PublishedAt = item.PublishedAt, Reason = item.Reason, Content = Project(item.Content)
    };

    private static HomepageContentDto Project(HomepageContent item) => new()
    {
        Order = [.. item.Order], Hero = Project(item.Hero), Announcement = Project(item.Announcement), About = Project(item.About), Join = Project(item.Join),
        Stories = [.. item.Stories.Select(story => Project(story)!)]
    };

    private static HomepageBlockDto? Project(HomepageBlock? item) => item is null ? null : new()
    {
        Id = item.Id, LinkUrl = item.LinkUrl,
        Texts = item.Texts.ToDictionary(t => t.Key, t => new HomepageTextDto { Title = t.Value.Title, Body = t.Value.Body, LinkLabel = t.Value.LinkLabel })
    };
}
