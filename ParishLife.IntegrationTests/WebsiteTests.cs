// Purpose: verifies parish website drafts, review and publication (N06) through real local services and storage.
// Main tests: drafts keep the live revision online; submission needs EN/FR/AR; a priest other than the author returns or publishes;
// publishing supersedes the previous revision; unpublishing needs a reason; visitors read only published text in their language.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Publishing;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class WebsiteTests
{
    [Fact]
    public async Task Sections_are_reviewed_in_three_languages_and_drafts_never_replace_the_live_text()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core"]);
        var author = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PublishingManage]));
        var reviewerAccount = await f.CreateVerifiedStaffAsync();
        var reviewer = await staff.AcceptAsync(await staff.InviteAsync(reviewerAccount, allows: [Permissions.PublishingManage]));
        var site = f.Services.GetRequiredService<WebsiteService>();

        f.AsAppointment(f.Other, author.Id);
        var section = await site.SaveDraftAsync(staff.Parish, "about", Draft(null, ("en", "About us")), default);
        Assert.Equal(["fr", "ar"], section.Pending!.MissingLanguages);
        Assert.Equal("invalid_website_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(site, staff.Parish, section.Pending, "submit"))).Code);
        section = await site.SaveDraftAsync(staff.Parish, "about", Draft(section.Pending.Version, ("en", "About us"), ("fr", "À propos"), ("ar", "من نحن")), default);
        var draft = section.Pending!;
        section = await ActAsync(site, staff.Parish, draft, "submit");
        await Assert.ThrowsAsync<DomainException>(() => site.SaveDraftAsync(staff.Parish, "about", Draft(section.Pending!.Version, ("en", "Too early")), default));
        Assert.Equal("invalid_website_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(site, staff.Parish, section.Pending!, "publish"))).Code);

        f.AsAppointment(reviewerAccount, reviewer.Id);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(site, staff.Parish, section.Pending!, "return"))).Code);
        section = await ActAsync(site, staff.Parish, section.Pending!, "return", "Add the visiting hours");
        Assert.Equal(("Returned", "Add the visiting hours"), (section.Pending!.Status, section.Pending.ReturnReason));
        f.AsAppointment(f.Other, author.Id);
        section = await ActAsync(site, staff.Parish, section.Pending, "submit");
        f.AsAppointment(reviewerAccount, reviewer.Id);
        section = await ActAsync(site, staff.Parish, section.Pending!, "publish");
        Assert.Equal(("Published", draft.Id, (WebsiteRevisionDto?)null), (section.Status, section.Published!.Id, section.Pending));
        Assert.Equal("من نحن", Assert.Single(await site.PublicAsync(staff.Parish, "ar", default)).Title);

        f.AsAppointment(f.Other, author.Id);
        section = await site.SaveDraftAsync(staff.Parish, "about", Draft(null, ("en", "About our parish"), ("fr", "Notre paroisse"), ("ar", "رعيتنا")), default);
        Assert.Equal("About us", Assert.Single(await site.PublicAsync(staff.Parish, null, default)).Title);
        section = await ActAsync(site, staff.Parish, section.Pending!, "submit");
        f.AsAppointment(reviewerAccount, reviewer.Id);
        section = await ActAsync(site, staff.Parish, section.Pending!, "publish");
        Assert.Equal("About our parish", Assert.Single(await site.PublicAsync(staff.Parish, "en", default)).Title);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(site, staff.Parish, section.Published!, "unpublish"))).Code);
        Assert.Equal("Unpublished", (await ActAsync(site, staff.Parish, section.Published!, "unpublish", "Being rewritten")).Status);
        Assert.Empty(await site.PublicAsync(staff.Parish, "fr", default));
    }

    private static SaveWebsiteDraftDto Draft(string? version, params (string Lang, string Title)[] texts) => new()
    {
        OperationId = Guid.NewGuid(), Version = version, Texts = texts.ToDictionary(t => t.Lang, t => new WebsiteTextDto { Title = t.Title, Body = t.Title + " body" })
    };

    private static Task<WebsiteSectionDto> ActAsync(WebsiteService site, string parish, WebsiteRevisionDto revision, string action, string? reason = null)
        => site.ActAsync(parish, "about", revision.Id, new WebsiteActionDto { OperationId = Guid.NewGuid(), Version = revision.Version, Action = action, Reason = reason }, default);
}
