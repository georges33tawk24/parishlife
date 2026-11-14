// Purpose: verifies the communications additions through real local services, Identity accounts and storage: scheduled broadcasts, bounded
// broadcast automations, Arabic versions of broadcasts/templates/notices, notice priority and author, and direct messages to a person.
// Main tests: scheduled broadcasts are stored only at their time and only while the scheduler keeps access; automations draft (never send), skip
// while a draft waits, pause when access or the template goes, and end at their run limit; Arabic versions are both-or-neither and never on an
// Arabic main text; urgent notices are listed first and authors are shown to staff only; the person route needs people.read and one linked account.

using System.Text.Json;
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

public class CommunicationsSchedulingTests
{
    [Fact]
    public async Task Scheduled_broadcasts_are_stored_only_at_their_time_and_only_while_the_scheduler_keeps_access()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var service = f.Services.GetRequiredService<BroadcastService>();
        var processor = f.Services.GetRequiredService<BroadcastScheduleProcessor>();
        var author = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var reviewer = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var leaving = await GrantAsync(s, [Permissions.CommunicationsManage], f.Clock.Now.AddHours(1));
        var (member, _, _) = await s.LinkedApplicantAsync();

        var draft = await ApprovedAsync(f, service, s.Parish, author, reviewer, "Feast day", "fr");
        f.As(author);
        var unapproved = await DraftAsync(service, s.Parish, "Not approved");
        Assert.Equal("invalid_broadcast_state", (await Assert.ThrowsAsync<DomainException>(async () =>
            await service.ActionAsync(s.Parish, unapproved.Id, await ScheduleAsync(service, s.Parish, unapproved.Id, f.Clock.Now.AddHours(1)), default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(async () =>
            await service.ActionAsync(s.Parish, draft, await ScheduleAsync(service, s.Parish, draft, f.Clock.Now.AddMinutes(-1)), default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(async () =>
            await service.ActionAsync(s.Parish, draft, await ScheduleAsync(service, s.Parish, draft, f.Clock.Now.AddDays(400)), default))).Code);
        var due = f.Clock.Now.AddHours(2);
        var scheduled = await service.ActionAsync(s.Parish, draft, await ScheduleAsync(service, s.Parish, draft, due), default);
        Assert.Equal(("Scheduled", due, author), (scheduled.Status, scheduled.ScheduledFor!.Value, scheduled.ScheduledBy!));
        Assert.All(scheduled.Channels, c => Assert.NotEqual("Stored", c.Status));
        // Scheduled by an account whose grant ends an hour from now, for three hours from now.
        var held = await ApprovedAsync(f, service, s.Parish, author, reviewer, "Held", "en");
        f.As(leaving);
        await service.ActionAsync(s.Parish, held, await ScheduleAsync(service, s.Parish, held, f.Clock.Now.AddHours(3)), default);

        // Nothing happens before the time; at the time the audience is resolved and stored once, attributed to the scheduler.
        await processor.ProcessPageAsync(null, default);
        f.As(member, mfa: false);
        Assert.Empty(await service.MineAsync(s.Parish, default));
        f.Clock.Now = due.AddMinutes(1);
        await processor.ProcessPageAsync(null, default);
        Assert.False(await processor.RunAsync(s.Parish, draft, default));
        f.As(member, mfa: false);
        Assert.Equal("Feast day", Assert.Single(await service.MineAsync(s.Parish, default)).Title);
        f.As(reviewer);
        var sent = (await service.ListAsync(s.Parish, default)).Single(r => r.Value.Id == draft).Value;
        Assert.Equal(("Sent", author, 1), (sent.Status, sent.SentBy!, sent.RecipientCount));
        Assert.Equal([("InApp", "Stored"), ("Email", "NotConfigured"), ("Sms", "NotConfigured"), ("Push", "NotConfigured")], sent.Channels.Select(c => (c.Channel, c.Status)).ToArray());

        // Unscheduling and cancelling remove the pending store.
        var second = await ApprovedAsync(f, service, s.Parish, author, reviewer, "Second", "en");
        f.As(author);
        await service.ActionAsync(s.Parish, second, await ScheduleAsync(service, s.Parish, second, f.Clock.Now.AddHours(1)), default);
        var back = await service.ActionAsync(s.Parish, second, await ActionAsync(service, s.Parish, second, "unschedule"), default);
        Assert.Equal(("Approved", (DateTimeOffset?)null), (back.Status, back.ScheduledFor));
        await service.ActionAsync(s.Parish, second, await ScheduleAsync(service, s.Parish, second, f.Clock.Now.AddHours(1)), default);
        var cancel = await ActionAsync(service, s.Parish, second, "cancel");
        cancel.Reason = "Event moved";
        Assert.Equal("Cancelled", (await service.ActionAsync(s.Parish, second, cancel, default)).Status);
        f.Clock.Now = f.Clock.Now.AddHours(2);
        await processor.ProcessPageAsync(null, default);
        Assert.Null(await Records(f).ReadAsync<BroadcastWork>(Scope(s.Parish), "broadcastWork:" + second, default));
        f.As(member, mfa: false);
        Assert.Single(await service.MineAsync(s.Parish, default));

        // The scheduler's access ended before the time: nothing is stored and the broadcast returns to Approved with a note.
        f.As(reviewer);
        var row = (await service.ListAsync(s.Parish, default)).Single(r => r.Value.Id == held).Value;
        Assert.Equal(("Approved", 0), (row.Status, row.RecipientCount));
        Assert.NotNull(row.ScheduleNote);
        f.As(member, mfa: false);
        Assert.Single(await service.MineAsync(s.Parish, default));

        // Members and recovery sessions cannot schedule.
        await Assert.ThrowsAsync<DomainException>(async () => await service.ActionAsync(s.Parish, held, new BroadcastActionDto
        {
            OperationId = Guid.NewGuid(), Version = "\"x\"", Action = "schedule", ScheduledFor = f.Clock.Now.AddHours(1)
        }, default));
        f.AsRecovery(author);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(async () => await service.ActionAsync(s.Parish, held, new BroadcastActionDto
        {
            OperationId = Guid.NewGuid(), Version = "\"x\"", Action = "schedule", ScheduledFor = f.Clock.Now.AddHours(1)
        }, default))).Code);
    }

    [Fact]
    public async Task Automations_draft_one_broadcast_per_due_time_and_never_approve_or_send()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var broadcasts = f.Services.GetRequiredService<BroadcastService>();
        var automations = f.Services.GetRequiredService<BroadcastAutomationService>();
        var processor = f.Services.GetRequiredService<BroadcastScheduleProcessor>();
        var owner = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var reviewer = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var (member, _, _) = await s.LinkedApplicantAsync();

        f.As(owner);
        var draftTemplate = await broadcasts.SaveTemplateAsync(s.Parish, null, new SaveBroadcastTemplateDto
        {
            OperationId = Guid.NewGuid(), Name = "Weekly notice", Title = "Weekly notice", Body = "Isolated weekly body", Language = "en",
            TitleAr = "Isolated Arabic title", BodyAr = "Isolated Arabic body"
        }, default);
        Assert.Equal("invalid_broadcast_state", (await Assert.ThrowsAsync<DomainException>(() =>
            automations.SaveAsync(s.Parish, null, Automation(draftTemplate.Id, f.Clock.Now.AddDays(1), 3), default))).Code);
        f.As(reviewer);
        await broadcasts.TemplateActionAsync(s.Parish, draftTemplate.Id, await TemplateActionAsync(broadcasts, s.Parish, draftTemplate.Id, "approve"), default);

        f.As(owner);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() =>
            automations.SaveAsync(s.Parish, null, Automation(draftTemplate.Id, f.Clock.Now.AddMinutes(-5), 3), default))).Code);
        var first = f.Clock.Now.AddDays(1);
        var automation = await automations.SaveAsync(s.Parish, null, Automation(draftTemplate.Id, first, 3), default);
        Assert.Equal(("Active", first, 0), (automation.Status, automation.NextRunAt, automation.RunCount));

        // Members and recovery sessions do not see automations.
        f.As(member, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => automations.ListAsync(s.Parish, default));
        f.AsRecovery(owner);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => automations.ListAsync(s.Parish, default))).Code);

        // Before the due time nothing is drafted; at it one draft is created with the template's wording, owned by the responsible account.
        await processor.ProcessPageAsync(null, default);
        f.As(owner);
        Assert.Empty(await broadcasts.ListAsync(s.Parish, default));
        f.Clock.Now = first.AddMinutes(1);
        await processor.ProcessPageAsync(null, default);
        var created = Assert.Single(await broadcasts.ListAsync(s.Parish, default)).Value;
        Assert.Equal(("Draft", automation.Id, owner, "Isolated Arabic title"), (created.Status, created.AutomationId!, created.UpdatedBy, created.TitleAr!));
        Assert.Equal(0, created.RecipientCount);
        Assert.Equal("independent_approval_required", (await Assert.ThrowsAsync<DomainException>(async () =>
            await broadcasts.ActionAsync(s.Parish, created.Id, await ActionAsync(broadcasts, s.Parish, created.Id, "approve"), default))).Code);
        var state = Assert.Single(await automations.ListAsync(s.Parish, default)).Value;
        Assert.Equal(("Drafted", 1, first.AddDays(7)), (state.LastOutcome!, state.RunCount, state.NextRunAt));
        f.As(member, mfa: false);
        Assert.Empty(await broadcasts.MineAsync(s.Parish, default));

        // The next due time adds nothing while the previous draft still waits.
        f.Clock.Now = first.AddDays(7).AddMinutes(1);
        await processor.ProcessPageAsync(null, default);
        f.As(owner);
        Assert.Single(await broadcasts.ListAsync(s.Parish, default));
        Assert.Equal(("Skipped", 2), (Assert.Single(await automations.ListAsync(s.Parish, default)).Value.LastOutcome!, Assert.Single(await automations.ListAsync(s.Parish, default)).Value.RunCount));

        // Pausing removes the pending run; resuming continues from the next future due time, and the run limit ends it.
        var paused = await automations.ActionAsync(s.Parish, automation.Id, await AutomationActionAsync(automations, s.Parish, automation.Id, "pause"), default);
        Assert.Equal("Paused", paused.Status);
        Assert.Null(await Records(f).ReadAsync<BroadcastWork>(Scope(s.Parish), "broadcastWork:" + automation.Id, default));
        var cancel = await ActionAsync(broadcasts, s.Parish, created.Id, "cancel");
        cancel.Reason = "Not needed this week";
        await broadcasts.ActionAsync(s.Parish, created.Id, cancel, default);
        f.As(reviewer);
        var resumed = await automations.ActionAsync(s.Parish, automation.Id, await AutomationActionAsync(automations, s.Parish, automation.Id, "resume"), default);
        Assert.Equal(("Active", reviewer, first.AddDays(14)), (resumed.Status, resumed.UpdatedBy, resumed.NextRunAt));
        f.Clock.Now = first.AddDays(14).AddMinutes(1);
        await processor.ProcessPageAsync(null, default);
        var ended = Assert.Single(await automations.ListAsync(s.Parish, default)).Value;
        Assert.Equal(("Ended", 3, "Drafted"), (ended.Status, ended.RunCount, ended.LastOutcome!));
        Assert.Equal(2, (await broadcasts.ListAsync(s.Parish, default)).Count);
        Assert.Null(await Records(f).ReadAsync<BroadcastWork>(Scope(s.Parish), "broadcastWork:" + automation.Id, default));
        Assert.Equal("invalid_automation_state", (await Assert.ThrowsAsync<DomainException>(async () =>
            await automations.ActionAsync(s.Parish, automation.Id, await AutomationActionAsync(automations, s.Parish, automation.Id, "resume"), default))).Code);

        // A retired template pauses the automation at its next run instead of drafting.
        var second = await automations.SaveAsync(s.Parish, null, Automation(draftTemplate.Id, f.Clock.Now.AddHours(1), 2), default);
        await broadcasts.TemplateActionAsync(s.Parish, draftTemplate.Id, await TemplateActionAsync(broadcasts, s.Parish, draftTemplate.Id, "retire"), default);
        f.Clock.Now = f.Clock.Now.AddHours(2);
        await processor.ProcessPageAsync(null, default);
        var halted = (await automations.ListAsync(s.Parish, default)).Single(r => r.Value.Id == second.Id).Value;
        Assert.Equal(("Paused", 0), (halted.Status, halted.RunCount));
        Assert.NotNull(halted.StatusReason);
        Assert.Equal(2, (await broadcasts.ListAsync(s.Parish, default)).Count);
    }

    [Fact]
    public async Task Arabic_versions_are_stored_as_typed_and_notices_carry_priority_and_a_staff_only_author()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var broadcasts = f.Services.GetRequiredService<BroadcastService>();
        var notices = f.Services.GetRequiredService<CommunicationsService>();
        var author = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var reviewer = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var (member, _, _) = await s.LinkedApplicantAsync();

        f.As(author);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => broadcasts.SaveAsync(s.Parish, null, new SaveBroadcastDto
        {
            OperationId = Guid.NewGuid(), Audience = "Members", Title = "Only title", Body = "Body", Language = "en", TitleAr = "Isolated Arabic title"
        }, default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => broadcasts.SaveAsync(s.Parish, null, new SaveBroadcastDto
        {
            OperationId = Guid.NewGuid(), Audience = "Members", Title = "Arabic main", Body = "Body", Language = "ar", TitleAr = "Twin", BodyAr = "Twin"
        }, default))).Code);
        var pair = await broadcasts.SaveAsync(s.Parish, null, new SaveBroadcastDto
        {
            OperationId = Guid.NewGuid(), Audience = "Members", Title = "Bilingual", Body = "Isolated English body", Language = "en",
            TitleAr = " Isolated Arabic title ", BodyAr = "Isolated Arabic body"
        }, default);
        Assert.Equal(("Isolated Arabic title", "Isolated Arabic body"), (pair.TitleAr!, pair.BodyAr!));
        f.As(reviewer);
        await broadcasts.ActionAsync(s.Parish, pair.Id, await ActionAsync(broadcasts, s.Parish, pair.Id, "approve"), default);
        await broadcasts.ActionAsync(s.Parish, pair.Id, await ActionAsync(broadcasts, s.Parish, pair.Id, "send"), default);
        f.As(member, mfa: false);
        var mine = Assert.Single(await broadcasts.MineAsync(s.Parish, default));
        Assert.Equal(("Bilingual", "Isolated Arabic title", "Isolated Arabic body"), (mine.Title, mine.TitleAr!, mine.BodyAr!));

        // Notices: urgent first for readers, the author only for staff, and the Arabic version as typed.
        f.As(author);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => notices.SaveAnnouncementAsync(s.Parish, null, new SaveAnnouncementDto
        {
            OperationId = Guid.NewGuid(), Visibility = "Members", Title = "T", Body = "B", Language = "en", BodyAr = "Only body"
        }, default))).Code);
        foreach (var (title, priority, pinned) in new[] { ("Pinned normal", "Normal", true), ("Urgent notice", "Urgent", false), ("Plain", "Normal", false) })
        {
            var saved = await notices.SaveAnnouncementAsync(s.Parish, null, new SaveAnnouncementDto
            {
                OperationId = Guid.NewGuid(), Visibility = "Members", Title = title, Body = title + " body", Language = "en", Priority = priority, Pinned = pinned,
                TitleAr = title == "Urgent notice" ? "Isolated urgent Arabic" : null, BodyAr = title == "Urgent notice" ? "Isolated urgent Arabic body" : null
            }, default);
            await notices.AnnouncementActionAsync(s.Parish, saved.Id, new AnnouncementActionDto
            {
                OperationId = Guid.NewGuid(), Version = (await Records(f).ReadAsync<Announcement>(Scope(s.Parish), "announcement:" + saved.Id, default))!.Version, Action = "publish"
            }, default);
            f.Clock.Now = f.Clock.Now.AddMinutes(1);
        }
        var staffList = await notices.StaffAnnouncementsAsync(s.Parish, default);
        Assert.All(staffList, r => Assert.Equal(author, r.Value.AuthorAccountId));
        Assert.Equal("Urgent", staffList.Single(r => r.Value.Title == "Urgent notice").Value.Priority);
        f.As(member, mfa: false);
        var seen = await notices.MemberAnnouncementsAsync(s.Parish, default);
        Assert.Equal(["Urgent notice", "Pinned normal", "Plain"], seen.Select(a => a.Title).ToArray());
        Assert.Equal("Isolated urgent Arabic", seen[0].TitleAr);
        Assert.All(seen, a => Assert.Null(a.AuthorAccountId));
        Assert.DoesNotContain(author, JsonSerializer.Serialize(seen));
    }

    [Fact]
    public async Task Office_staff_with_people_access_write_directly_to_a_persons_single_linked_account()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var inbox = f.Services.GetRequiredService<InboxService>();
        var officeOnly = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var office = await GrantAsync(s, [Permissions.CommunicationsManage, Permissions.PeopleRead]);
        var (member, person, _) = await s.LinkedApplicantAsync();
        var other = await s.LinkedApplicantAsync();
        s.Use();
        var unlinked = await f.Services.GetRequiredService<ParishLife.Api.Services.People.PeopleService>().CreateAsync(s.Parish, new ParishLife.Api.DTOs.People.CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Unlinked", BirthDate = new DateOnly(1985, 1, 1)
        }, default);

        // Without people.read the person route reveals nothing; members cannot use it at all.
        f.As(officeOnly);
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => inbox.StartAsync(s.Parish, ToPerson(person), default))).Code);
        f.As(other.AccountId, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => inbox.StartAsync(s.Parish, ToPerson(person), default));

        f.As(office);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => inbox.StartAsync(s.Parish, ToPerson(unlinked.Id), default))).Code);
        var both = ToPerson(person);
        both.RecipientAccountId = Guid.Parse(member);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => inbox.StartAsync(s.Parish, both, default))).Code);
        var direct = await inbox.StartAsync(s.Parish, ToPerson(person), default);
        Assert.Equal(("Direct", office), (direct.Kind, direct.CreatedBy));
        Assert.Contains(member, direct.ParticipantAccountIds);

        f.As(member, mfa: false);
        var received = Assert.Single(await inbox.ListAsync(s.Parish, default));
        Assert.Equal((direct.Id, office), (received.Id, received.CreatedBy));
        f.As(other.AccountId, mfa: false);
        Assert.Empty(await inbox.ListAsync(s.Parish, default));
    }

    private static StartConversationDto ToPerson(string person) => new()
    {
        OperationId = Guid.NewGuid(), Subject = "Isolated direct subject", Body = "Isolated direct body", RecipientPersonId = Guid.Parse(person)
    };

    private static SaveBroadcastAutomationDto Automation(string template, DateTimeOffset first, int runs) => new()
    {
        OperationId = Guid.NewGuid(), Name = "Isolated weekly automation", TemplateId = Guid.Parse(template), Audience = "Members", Recurrence = "Weekly",
        FirstRunAt = first, MaxRuns = runs
    };

    private static async Task<string> GrantAsync(MinistryScenario s, string[] allows, DateTimeOffset? endsAt = null)
    {
        var account = await s.Fixture.CreateVerifiedStaffAsync();
        s.Fixture.As(s.Fixture.FirstAdmin);
        await s.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(account), Allows = allows, StartsAt = s.Fixture.Clock.Now.AddDays(-2), EndsAt = endsAt
        }, default);
        return account;
    }

    private static async Task<BroadcastDto> DraftAsync(BroadcastService service, string parish, string title)
        => await service.SaveAsync(parish, null, new SaveBroadcastDto { OperationId = Guid.NewGuid(), Audience = "Members", Title = title, Body = title + " body", Language = "en" }, default);

    private static async Task<string> ApprovedAsync(LocalBackendFixture f, BroadcastService service, string parish, string author, string reviewer, string title, string language)
    {
        f.As(author);
        var draft = await service.SaveAsync(parish, null, new SaveBroadcastDto { OperationId = Guid.NewGuid(), Audience = "Members", Title = title, Body = title + " body", Language = language }, default);
        f.As(reviewer);
        await service.ActionAsync(parish, draft.Id, await ActionAsync(service, parish, draft.Id, "approve"), default);
        return draft.Id;
    }

    private static async Task<BroadcastActionDto> ScheduleAsync(BroadcastService service, string parish, string id, DateTimeOffset when)
    {
        var action = await ActionAsync(service, parish, id, "schedule");
        action.ScheduledFor = when;
        return action;
    }

    private static async Task<BroadcastActionDto> ActionAsync(BroadcastService service, string parish, string id, string action) => new()
    {
        OperationId = Guid.NewGuid(), Action = action, Version = (await service.ListAsync(parish, default)).Single(r => r.Value.Id == id).Version
    };

    private static async Task<BroadcastActionDto> TemplateActionAsync(BroadcastService service, string parish, string id, string action) => new()
    {
        OperationId = Guid.NewGuid(), Action = action, Version = (await service.TemplatesAsync(parish, default)).Single(r => r.Value.Id == id).Version
    };

    private static async Task<BroadcastAutomationActionDto> AutomationActionAsync(BroadcastAutomationService service, string parish, string id, string action) => new()
    {
        OperationId = Guid.NewGuid(), Action = action, Version = (await service.ListAsync(parish, default)).Single(r => r.Value.Id == id).Version
    };

    private static IRecordTransactions Records(LocalBackendFixture f) => f.Services.GetRequiredService<IRecordTransactions>();

    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
}
