// Purpose: verifies announcements and prayer intentions (S26.07–S26.08) through real local services and storage.
// Main tests: audience-scoped announcements (public, members, current ministry members) with separate public publishing rights, expiry and
// no in-place edits after publication; prayer intentions stay clergy-private and are published only within the submitter's chosen limit.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CommunicationsTests
{
    [Fact]
    public async Task Announcements_reach_only_their_audience_and_public_ones_need_publishing_rights()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var group = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(group.Id, member.AccountId);
        await s.ApplicationActionAsync(group.Id, join.Id, "approve");
        var outsider = await s.LinkedApplicantAsync();
        var writer = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var publisher = await GrantAsync(s, [Permissions.CommunicationsManage, Permissions.PublishingManage]);
        var service = f.Services.GetRequiredService<CommunicationsService>();

        f.As(writer);
        var forMembers = await PublishAsync(f, service, s.Parish, Draft("Members", null, "Parish picnic"));
        await PublishAsync(f, service, s.Parish, Draft("Ministry", group.Id, "Choir rehearsal moved"));
        var expiring = Draft("Members", null, "Short notice");
        expiring.ExpiresAt = f.Clock.Now.AddHours(1);
        await PublishAsync(f, service, s.Parish, expiring);
        var forPublic = await service.SaveAnnouncementAsync(s.Parish, null, Draft("Public", null, "Christmas Mass times"), default);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(f, service, s.Parish, forPublic.Id, "publish"));
        await service.SaveAnnouncementAsync(s.Parish, null, Draft("Public", null, "Unpublished draft"), default);
        f.As(publisher);
        await ActAsync(f, service, s.Parish, forPublic.Id, "publish");
        var edit = Draft("Members", null, "Edited after publication");
        edit.Version = (await Records(f).ReadAsync<Announcement>(Scope(s.Parish), "announcement:" + forMembers.Id, default))!.Version;
        Assert.Equal("invalid_communication_state", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAnnouncementAsync(s.Parish, forMembers.Id, edit, default))).Code);

        f.Clock.Now = f.Clock.Now.AddHours(2);
        f.As(member.AccountId, mfa: false);
        var seen = await service.MemberAnnouncementsAsync(s.Parish, default);
        Assert.Equal(["Choir rehearsal moved", "Christmas Mass times", "Parish picnic"], seen.Select(a => a.Title).Order(StringComparer.Ordinal));
        Assert.All(seen, a => Assert.Null(a.PublishedBy));
        f.As(outsider.AccountId, mfa: false);
        Assert.Equal(["Christmas Mass times", "Parish picnic"], (await service.MemberAnnouncementsAsync(s.Parish, default)).Select(a => a.Title).Order(StringComparer.Ordinal));
        Assert.Equal("Christmas Mass times", Assert.Single(await service.PublicAnnouncementsAsync(s.Parish, default)).Title);
    }

    [Fact]
    public async Task Prayer_intentions_stay_clergy_private_and_are_published_only_within_the_submitters_limit()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var staff = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var submitter = await f.CreateVerifiedMemberAsync();
        var service = f.Services.GetRequiredService<CommunicationsService>();
        f.As(submitter, mfa: false);
        var privateOne = await service.SubmitIntentionAsync(s.Parish, Intention("For my sick mother", "ClergyPrivate"), default);
        var anonymous = await service.SubmitIntentionAsync(s.Parish, Intention("For peace", "AnonymousPublic"), default);
        var identified = Intention("Thanksgiving for our wedding", "IdentifiedPublic");
        identified.DisplayName = "The Isolated family";
        var named = await service.SubmitIntentionAsync(s.Parish, identified, default);
        Assert.Equal(3, (await service.OwnIntentionsAsync(s.Parish, default)).Count);

        f.As(staff);
        await Assert.ThrowsAsync<DomainException>(() => service.PriestIntentionsAsync(s.Parish, default));
        s.Use();
        Assert.Equal(3, (await service.PriestIntentionsAsync(s.Parish, default)).Count);
        Assert.Equal("invalid_communication_state", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, service, s.Parish, privateOne.Id, "publish-anonymous"))).Code);
        Assert.Equal("KeptPrivate", (await DecideAsync(f, service, s.Parish, privateOne.Id, "keep-private")).Status);
        await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, service, s.Parish, anonymous.Id, "publish-identified"));
        await DecideAsync(f, service, s.Parish, anonymous.Id, "publish-anonymous");
        await DecideAsync(f, service, s.Parish, named.Id, "publish-identified");

        var visible = await service.PublicIntentionsAsync(s.Parish, default);
        Assert.Equal(2, visible.Count);
        Assert.Null(visible.Single(i => i.Text == "For peace").DisplayName);
        Assert.Equal("The Isolated family", visible.Single(i => i.Text == "Thanksgiving for our wedding").DisplayName);
        Assert.DoesNotContain(visible, i => i.Text == "For my sick mother");
    }

    private static async Task<string> GrantAsync(MinistryScenario s, string[] allows)
    {
        var account = await s.Fixture.CreateVerifiedStaffAsync();
        s.Fixture.As(s.Fixture.FirstAdmin);
        await s.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(account), Allows = allows, StartsAt = s.Fixture.Clock.Now
        }, default);
        return account;
    }

    private static SaveAnnouncementDto Draft(string visibility, string? ministry, string title) => new()
    {
        OperationId = Guid.NewGuid(), Visibility = visibility, MinistryId = ministry is null ? null : Guid.Parse(ministry), Title = title, Body = title + " details", Language = "en"
    };

    private static async Task<AnnouncementDto> PublishAsync(LocalBackendFixture f, CommunicationsService service, string parish, SaveAnnouncementDto draft)
    {
        var saved = await service.SaveAnnouncementAsync(parish, null, draft, default);
        return await ActAsync(f, service, parish, saved.Id, "publish");
    }

    private static async Task<AnnouncementDto> ActAsync(LocalBackendFixture f, CommunicationsService service, string parish, string id, string action)
        => await service.AnnouncementActionAsync(parish, id, new AnnouncementActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await Records(f).ReadAsync<Announcement>(Scope(parish), "announcement:" + id, default))!.Version, Action = action
        }, default);

    private static SubmitIntentionDto Intention(string text, string visibility) => new() { OperationId = Guid.NewGuid(), Text = text, RequestedVisibility = visibility };

    private static async Task<PrayerIntentionDto> DecideAsync(LocalBackendFixture f, CommunicationsService service, string parish, string id, string decision)
        => await service.DecideIntentionAsync(parish, id, new IntentionDecisionDto
        {
            OperationId = Guid.NewGuid(), Version = (await Records(f).ReadAsync<PrayerIntention>(Scope(parish), "prayerIntention:" + id, default))!.Version, Decision = decision
        }, default);

    private static IRecordTransactions Records(LocalBackendFixture f) => f.Services.GetRequiredService<IRecordTransactions>();

    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
}
