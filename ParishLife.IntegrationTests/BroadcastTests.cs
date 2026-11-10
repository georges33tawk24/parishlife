// Purpose: verifies parish broadcasts and templates (N05) through real local services, Identity accounts and storage.
// Main tests: templates and broadcasts need a different approver of the exact version; the audience is resolved at send time from current links,
// ministry membership and optional-topic opt-outs; recipients see only their own copy; external channels stay NotConfigured; stale versions,
// replays, edits after approval, cancellation reasons, non-staff and recovery sessions are handled.

using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class BroadcastTests
{
    [Fact]
    public async Task Approved_broadcasts_reach_only_the_current_audience_and_report_channels_honestly()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var m = await MinistryScenario.CreateAsync(f);
        var service = f.Services.GetRequiredService<BroadcastService>();
        var author = await f.CreateVerifiedStaffAsync();
        var reviewer = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        foreach (var account in new[] { author, reviewer })
            await f.Services.GetRequiredService<ParishService>().GrantAsync(m.Parish, new GrantAccessDto
            {
                OperationId = Guid.NewGuid(), Version = (await m.Staff.Parishes.GetAsync(m.Parish, default))!.Version,
                AccountId = Guid.Parse(account), Allows = [Permissions.CommunicationsManage], StartsAt = f.Clock.Now
            }, default);

        var ministry = await m.MinistryAsync();
        var (inMinistry, _, _) = await m.LinkedApplicantAsync();
        var application = await m.ApplyAsync(ministry.Id, inMinistry);
        await m.ApplicationActionAsync(ministry.Id, application.Id, "approve");
        var (member, _, _) = await m.LinkedApplicantAsync();
        var (optedOut, _, _) = await m.LinkedApplicantAsync();
        var unlinked = await f.CreateVerifiedMemberAsync();
        f.As(optedOut, mfa: false);
        await f.Services.GetRequiredService<NotificationService>().SavePreferencesAsync(new NotificationPreferencesDto { MutedTopics = [BroadcastService.Topic], Language = "en" }, default);

        // Templates: drafted by one staff member, approved only by another, then immutable.
        f.As(author);
        var template = await service.SaveTemplateAsync(m.Parish, null, new SaveBroadcastTemplateDto
        {
            OperationId = Guid.NewGuid(), Name = "Parish update", Title = "Parish update", Body = "Isolated template body", Language = "fr"
        }, default);
        Assert.Equal("independent_approval_required", (await Assert.ThrowsAsync<DomainException>(async () =>
            await service.TemplateActionAsync(m.Parish, template.Id, await ActionAsync(service, m.Parish, template.Id, "approve", template: true), default))).Code);
        Assert.Equal("invalid_broadcast_state", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(m.Parish, null, new SaveBroadcastDto
        {
            OperationId = Guid.NewGuid(), Audience = "Members", TemplateId = Guid.Parse(template.Id)
        }, default))).Code);
        f.As(reviewer);
        Assert.Equal("Approved", (await service.TemplateActionAsync(m.Parish, template.Id, await ActionAsync(service, m.Parish, template.Id, "approve", template: true), default)).Status);

        f.As(author);
        var draft = await service.SaveAsync(m.Parish, null, new SaveBroadcastDto { OperationId = Guid.NewGuid(), Audience = "Members", TemplateId = Guid.Parse(template.Id) }, default);
        Assert.Equal(("Isolated template body", "fr", "Draft"), (draft.Body, draft.Language, draft.Status));
        Assert.All(draft.Channels, c => Assert.NotEqual("Stored", c.Status));
        Assert.Equal("independent_approval_required", (await Assert.ThrowsAsync<DomainException>(async () =>
            await service.ActionAsync(m.Parish, draft.Id, await ActionAsync(service, m.Parish, draft.Id, "approve"), default))).Code);

        f.As(reviewer);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.ActionAsync(m.Parish, draft.Id,
            new BroadcastActionDto { OperationId = Guid.NewGuid(), Version = "\"stale\"", Action = "approve" }, default))).Code);
        await service.ActionAsync(m.Parish, draft.Id, await ActionAsync(service, m.Parish, draft.Id, "approve"), default);
        Assert.Equal("invalid_broadcast_state", (await Assert.ThrowsAsync<DomainException>(async () => await service.SaveAsync(m.Parish, draft.Id, new SaveBroadcastDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(service, m.Parish, draft.Id), Audience = "Members", Title = "Changed", Body = "Changed", Language = "en"
        }, default))).Code);
        var preview = await service.PreviewAsync(m.Parish, draft.Id, default);
        Assert.Equal((2, 1), (preview.EligibleCount, preview.SkippedByPreferenceCount));

        // The audience is resolved at send time: a parishioner linked after approval is included.
        var (late, _, _) = await m.LinkedApplicantAsync();
        f.As(author);
        var send = await ActionAsync(service, m.Parish, draft.Id, "send");
        var sent = await service.ActionAsync(m.Parish, draft.Id, send, default);
        Assert.Equal(sent.SentAt, (await service.ActionAsync(m.Parish, draft.Id, send, default)).SentAt);
        Assert.Equal(("Sent", 3, 1), (sent.Status, sent.RecipientCount, sent.SkippedByPreferenceCount));
        Assert.Equal([("InApp", "Stored"), ("Email", "NotConfigured"), ("Sms", "NotConfigured"), ("Push", "NotConfigured")],
            sent.Channels.Select(c => (c.Channel, c.Status)).ToArray());
        Assert.DoesNotContain(member, JsonSerializer.Serialize(await service.ListAsync(m.Parish, default)));
        Assert.Equal("invalid_broadcast_state", (await Assert.ThrowsAsync<DomainException>(async () =>
            await service.ActionAsync(m.Parish, draft.Id, await ActionAsync(service, m.Parish, draft.Id, "send"), default))).Code);

        // Ministry broadcast: only current ministry members.
        var ministryDraft = await service.SaveAsync(m.Parish, null, new SaveBroadcastDto
        {
            OperationId = Guid.NewGuid(), Audience = "Ministry", MinistryId = Guid.Parse(ministry.Id), Title = "Rehearsal", Body = "Isolated ministry body", Language = "en"
        }, default);
        f.As(reviewer);
        await service.ActionAsync(m.Parish, ministryDraft.Id, await ActionAsync(service, m.Parish, ministryDraft.Id, "approve"), default);
        Assert.Equal(1, (await service.ActionAsync(m.Parish, ministryDraft.Id, await ActionAsync(service, m.Parish, ministryDraft.Id, "send"), default)).RecipientCount);

        foreach (var (account, expected) in new[] { (inMinistry, 2), (member, 1), (late, 1), (optedOut, 0), (unlinked, 0) })
        {
            f.As(account, mfa: false);
            var mine = await service.MineAsync(m.Parish, default);
            Assert.Equal(expected, mine.Count);
            var json = JsonSerializer.Serialize(mine);
            Assert.DoesNotContain(author, json);
            Assert.DoesNotContain(account == member ? late : member, json);
        }

        // Non-staff and recovery sessions have no staff routes; cancellation needs a reason and stops a pending send.
        f.As(member, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(m.Parish, default));
        f.AsRecovery(author);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(m.Parish, default))).Code);
        f.AsRecovery(member);
        await Assert.ThrowsAsync<DomainException>(() => service.MineAsync(m.Parish, default));
        f.As(author);
        var cancelled = await service.SaveAsync(m.Parish, null, new SaveBroadcastDto
        {
            OperationId = Guid.NewGuid(), Audience = "Members", Title = "Mistake", Body = "Mistake", Language = "ar"
        }, default);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(async () =>
            await service.ActionAsync(m.Parish, cancelled.Id, await ActionAsync(service, m.Parish, cancelled.Id, "cancel"), default))).Code);
        var cancel = await ActionAsync(service, m.Parish, cancelled.Id, "cancel");
        cancel.Reason = "Drafted in error";
        Assert.Equal("Cancelled", (await service.ActionAsync(m.Parish, cancelled.Id, cancel, default)).Status);
        Assert.Equal("invalid_broadcast_state", (await Assert.ThrowsAsync<DomainException>(async () =>
            await service.ActionAsync(m.Parish, cancelled.Id, await ActionAsync(service, m.Parish, cancelled.Id, "send"), default))).Code);
    }

    private static async Task<string> VersionAsync(BroadcastService service, string parish, string id)
        => (await service.ListAsync(parish, default)).Single(r => r.Value.Id == id).Version;

    private static async Task<BroadcastActionDto> ActionAsync(BroadcastService service, string parish, string id, string action, bool template = false) => new()
    {
        OperationId = Guid.NewGuid(), Action = action,
        Version = template ? (await service.TemplatesAsync(parish, default)).Single(r => r.Value.Id == id).Version : await VersionAsync(service, parish, id)
    };
}
