// Purpose: verifies the platform homepage editor (X08) through the real local services, Identity accounts and storage.
// Main tests: drafts never change the live page and report EN/FR/AR readiness; publishing needs the reviewed draft version and complete languages;
// republishing supersedes and keeps history; visitors get only the live text in their language; unsafe links, markup-like control text and bad
// structure are refused; exact retries replay; only current MFA platform operators may edit or publish.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Publishing;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class HomepageTests
{
    private static HomepageService Home(LocalBackendFixture f) => f.Services.GetRequiredService<HomepageService>();

    private static HomepageBlockDto Block(string id, string title, bool all = true, string? link = null)
    {
        var texts = new Dictionary<string, HomepageTextDto> { ["en"] = new() { Title = title, Body = title + " body" } };
        if (all)
        {
            texts["fr"] = new() { Title = title + " FR", Body = title + " corps" };
            texts["ar"] = new() { Title = title + " AR", Body = title + " نص" };
        }
        return new HomepageBlockDto { Id = id, Texts = texts, LinkUrl = link };
    }

    private static HomepageContentDto Content(bool complete = true) => new()
    {
        Order = ["hero", "stories", "about"],
        Hero = Block("ignored", "Welcome", complete, "/parishes"),
        About = Block("ignored", "About", true),
        Stories = [Block("spring-pilgrimage", "Pilgrimage", true, "https://example.org/story")]
    };

    private static SaveHomepageDraftDto Save(HomepageContentDto content, string? version = null) => new() { OperationId = Guid.NewGuid(), Version = version, Content = content };

    private static async Task<LocalBackendFixture> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        return f;
    }

    [Fact]
    public async Task Drafts_report_language_readiness_and_never_change_the_live_page()
    {
        await using var f = await StartAsync();
        f.As(f.FirstAdmin);
        var home = Home(f);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => home.GetDraftAsync(default))).Kind);

        var saved = await home.SaveDraftAsync(Save(Content(complete: false)), default);
        var readiness = saved.Value.Readiness.ToDictionary(r => r.Language);
        Assert.True(readiness["en"].Complete);
        Assert.False(readiness["fr"].Complete);
        Assert.Equal(["hero.title", "hero.body"], readiness["fr"].Missing);
        Assert.Equal(["hero.title", "hero.body"], readiness["ar"].Missing);
        // Singleton blocks take their section key as id, whatever the caller supplied.
        Assert.Equal("hero", saved.Value.Content.Hero!.Id);

        // Nothing is public until publication, even though a draft exists.
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => home.PublicAsync("en", default))).Kind);
        var publish = await Assert.ThrowsAsync<DomainException>(() => home.PublishAsync(new PublishHomepageDto { OperationId = Guid.NewGuid(), Version = saved.Version }, default));
        Assert.Equal("homepage_translation_incomplete", publish.Code);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => home.PublicAsync("en", default))).Kind);

        // A section listed in Order but with no block is also reported as missing in every language.
        var gap = Content();
        gap.Join = null;
        gap.Order = ["hero", "join"];
        var gapped = await home.SaveDraftAsync(Save(gap, saved.Version), default);
        Assert.All(gapped.Value.Readiness, r => Assert.Contains("join", r.Missing));
    }

    [Fact]
    public async Task Draft_versions_are_enforced_and_exact_retries_replay()
    {
        await using var f = await StartAsync();
        f.As(f.FirstAdmin);
        var home = Home(f);
        var first = Save(Content());
        var saved = await home.SaveDraftAsync(first, default);
        var replay = await home.SaveDraftAsync(first, default);
        Assert.Equal(saved.Version, replay.Version);

        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => home.SaveDraftAsync(Save(Content()), default))).Code);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => home.SaveDraftAsync(Save(Content(), "stale"), default))).Code);
        var next = await home.SaveDraftAsync(Save(Content(), saved.Version), default);
        Assert.NotEqual(saved.Version, next.Version);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => home.SaveDraftAsync(Save(Content(), saved.Version), default))).Code);
    }

    [Fact]
    public async Task Publishing_exposes_only_the_reviewed_draft_and_each_republish_supersedes_the_last()
    {
        await using var f = await StartAsync();
        f.As(f.FirstAdmin);
        var home = Home(f);
        var draft = await home.SaveDraftAsync(Save(Content()), default);

        // The draft changed after it was reviewed, so the reviewed version can no longer be published.
        var later = await home.SaveDraftAsync(Save(Content(), draft.Version), default);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => home.PublishAsync(new PublishHomepageDto { OperationId = Guid.NewGuid(), Version = draft.Version }, default))).Code);

        var request = new PublishHomepageDto { OperationId = Guid.NewGuid(), Version = later.Version, Reason = "First launch text" };
        var first = await home.PublishAsync(request, default);
        Assert.Equal(("Published", f.FirstAdmin), (first.Status, first.PublishedBy));
        Assert.Equal(first.Id, (await home.PublishAsync(request, default)).Id);
        Assert.Single((await home.HistoryAsync(25, null, default)).Items);

        var english = await home.PublicAsync("en", default);
        Assert.Equal(["hero", "stories", "about"], english.Blocks.Select(b => b.Section).ToArray());
        Assert.Equal("Welcome", english.Blocks[0].Title);
        Assert.Equal("/parishes", english.Blocks[0].LinkUrl);
        Assert.Equal("spring-pilgrimage", english.Blocks[1].Id);
        Assert.Equal("Welcome FR", (await home.PublicAsync("fr", default)).Blocks[0].Title);
        Assert.Equal("Welcome AR", (await home.PublicAsync("ar", default)).Blocks[0].Title);
        // An unsupported language is served in English and says so.
        var unsupported = await home.PublicAsync("de", default);
        Assert.Equal(("en", "en"), (unsupported.Language, unsupported.Blocks[0].Language));

        // Editing the draft afterwards leaves the live text alone until the new version is published.
        var edited = Content();
        edited.Hero = Block("hero", "Changed", true);
        var changedDraft = await home.SaveDraftAsync(Save(edited, later.Version), default);
        Assert.Equal("Welcome", (await home.PublicAsync("en", default)).Blocks[0].Title);

        f.Clock.Now = f.Clock.Now.AddMinutes(10);
        var second = await home.PublishAsync(new PublishHomepageDto { OperationId = Guid.NewGuid(), Version = changedDraft.Version }, default);
        Assert.Equal("Changed", (await home.PublicAsync("en", default)).Blocks[0].Title);
        var history = (await home.HistoryAsync(25, null, default)).Items;
        Assert.Equal([second.Id, first.Id], history.Select(h => h.Id).ToArray());
        Assert.Equal(["Published", "Superseded"], history.Select(h => h.Status).ToArray());
    }

    [Fact]
    public async Task Public_projection_hides_incomplete_blocks_and_never_returns_editor_information()
    {
        await using var f = await StartAsync();
        f.As(f.FirstAdmin);
        var home = Home(f);
        var draft = await home.SaveDraftAsync(Save(Content()), default);
        await home.PublishAsync(new PublishHomepageDto { OperationId = Guid.NewGuid(), Version = draft.Version }, default);
        var json = System.Text.Json.JsonSerializer.Serialize(await home.PublicAsync("en", default));
        Assert.DoesNotContain(f.FirstAdmin, json);
        Assert.DoesNotContain("PublishedBy", json);
        Assert.DoesNotContain("Reason", json);

        // An empty-order publication is refused.
        var empty = await home.SaveDraftAsync(Save(new HomepageContentDto(), draft.Version), default);
        Assert.Equal("homepage_translation_incomplete", (await Assert.ThrowsAsync<DomainException>(() => home.PublishAsync(new PublishHomepageDto { OperationId = Guid.NewGuid(), Version = empty.Version }, default))).Code);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("data:text/html;base64,AAAA")]
    [InlineData("http://example.org/plain")]
    [InlineData("//evil.example/path")]
    [InlineData("https://user:pass@example.org/")]
    [InlineData("https://exa mple.org/")]
    [InlineData("mailto:someone@example.org")]
    [InlineData("\\\\server\\share")]
    [InlineData("ftp://example.org/file")]
    [InlineData("example.org/no-scheme")]
    public async Task Unsafe_links_are_refused(string link)
    {
        await using var f = await StartAsync();
        f.As(f.FirstAdmin);
        var content = Content();
        content.Hero!.LinkUrl = link;
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => Home(f).SaveDraftAsync(Save(content), default))).Code);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Home(f).GetDraftAsync(default))).Kind);
    }

    [Theory]
    [InlineData("/parishes")]
    [InlineData("/join?from=home")]
    [InlineData("https://example.org/a/b?c=d")]
    public async Task Safe_links_are_kept(string link)
    {
        await using var f = await StartAsync();
        f.As(f.FirstAdmin);
        var content = Content();
        content.About!.LinkUrl = link;
        Assert.Equal(link, (await Home(f).SaveDraftAsync(Save(content), default)).Value.Content.About!.LinkUrl);
    }

    [Fact]
    public async Task Structure_languages_text_and_story_rules_are_validated()
    {
        await using var f = await StartAsync();
        f.As(f.FirstAdmin);
        var home = Home(f);
        async Task Refuse(Action<HomepageContentDto> change)
        {
            var content = Content();
            change(content);
            Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => home.SaveDraftAsync(Save(content), default))).Code);
        }

        await Refuse(c => c.Order = ["hero", "hero"]);
        await Refuse(c => c.Order = ["hero", "footer"]);
        await Refuse(c => c.Hero!.Texts["de"] = new HomepageTextDto { Title = "x", Body = "y" });
        await Refuse(c => c.Hero!.Texts["en"].Title = new string('t', 201));
        await Refuse(c => c.Hero!.Texts["en"].Body = new string('b', 5001));
        await Refuse(c => c.Hero!.Texts["en"].Body = "bell\u0007character");
        await Refuse(c => c.Stories[0].Id = "Bad Key");
        await Refuse(c => c.Stories[0].Id = "x");
        await Refuse(c => c.Stories = [Block("same-key", "A"), Block("same-key", "B")]);
        await Refuse(c => c.Stories = [.. Enumerable.Range(0, HomepageService.MaximumStories + 1).Select(i => Block("story-" + i, "Story " + i))]);

        // Line breaks are plain text and are allowed; exactly the maximum number of stories is allowed.
        var ok = Content();
        ok.Hero!.Texts["en"].Body = "line one\nline two";
        ok.Stories = [.. Enumerable.Range(0, HomepageService.MaximumStories).Select(i => Block("story-" + i, "Story " + i))];
        Assert.Equal(HomepageService.MaximumStories, (await home.SaveDraftAsync(Save(ok), default)).Value.Content.Stories.Count);
    }

    [Fact]
    public async Task Only_current_mfa_platform_operators_can_edit_publish_or_read_the_draft_but_anyone_reads_the_live_page()
    {
        await using var f = await StartAsync();
        f.As(f.FirstAdmin);
        var home = Home(f);
        var draft = await home.SaveDraftAsync(Save(Content()), default);
        await home.PublishAsync(new PublishHomepageDto { OperationId = Guid.NewGuid(), Version = draft.Version }, default);

        var member = await f.CreateVerifiedMemberAsync();
        foreach (var denied in new Action[] { () => f.As(f.Nominee), () => f.As(member, mfa: false), () => f.As(f.FirstAdmin, mfa: false), () => f.AsRecovery(f.FirstAdmin) })
        {
            denied();
            await Assert.ThrowsAnyAsync<DomainException>(() => home.GetDraftAsync(default));
            await Assert.ThrowsAnyAsync<DomainException>(() => home.SaveDraftAsync(Save(Content(), draft.Version), default));
            await Assert.ThrowsAnyAsync<DomainException>(() => home.PublishAsync(new PublishHomepageDto { OperationId = Guid.NewGuid(), Version = draft.Version }, default));
            await Assert.ThrowsAnyAsync<DomainException>(() => home.HistoryAsync(25, null, default));
            Assert.NotEmpty((await home.PublicAsync("en", default)).Blocks);
        }
        f.As(f.SecondAdmin);
        Assert.Single((await home.HistoryAsync(25, null, default)).Items);
    }
}
