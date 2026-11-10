// Purpose: verifies the parish inbox (S26.01–S26.06) and in-app notifications (S26.10–S26.15) through real local services and storage.
// Main tests: members write only to the office, office replies are attributed and notify the member, direct conversations need a linked
// parishioner, read/archive state is per participant; request updates notify applicants once and required notices cannot be muted.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class InboxAndNotificationTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Office)
    {
        public InboxService Inbox => F.Services.GetRequiredService<InboxService>();
        public NotificationService Notifications => F.Services.GetRequiredService<NotificationService>();
        public RequestService Requests => F.Services.GetRequiredService<RequestService>();
        public string Parish => Staff.Parish;
    }

    [Fact]
    public async Task Members_write_to_the_office_and_office_replies_are_attributed_and_notified()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        var stranger = await f.CreateVerifiedMemberAsync();
        var unlinked = await f.CreateVerifiedMemberAsync();

        f.As(member, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Inbox.StartAsync(x.Parish, Start("Direct attempt", stranger), default));
        var conversation = await x.Inbox.StartAsync(x.Parish, Start("Baptism question"), default);
        Assert.Equal("Office", conversation.Kind);

        f.As(stranger, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Inbox.MessagesAsync(x.Parish, conversation.Id, default));
        Assert.Empty(await x.Inbox.ListAsync(x.Parish, default));

        f.As(x.Office);
        var queued = Assert.Single(await x.Inbox.ListAsync(x.Parish, default));
        Assert.True(queued.Unread);
        Assert.Single(await x.Inbox.MessagesAsync(x.Parish, conversation.Id, default));
        Assert.False(Assert.Single(await x.Inbox.ListAsync(x.Parish, default)).Unread);
        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        var reply = await x.Inbox.PostAsync(x.Parish, conversation.Id, new PostInboxMessageDto { OperationId = Guid.NewGuid(), Body = "Call us on Monday." }, default);
        Assert.Equal(("Office", x.Office), (reply.Capacity, reply.AuthorAccountId));

        f.As(member, mfa: false);
        Assert.True(Assert.Single(await x.Inbox.ListAsync(x.Parish, default)).Unread);
        Assert.Equal("inbox.message", Assert.Single((await x.Notifications.ListAsync(null, 25, null, default)).Items).Topic);
        Assert.True((await x.Inbox.ArchiveAsync(x.Parish, conversation.Id, true, default)).Archived);
        f.As(x.Office);
        Assert.False(Assert.Single(await x.Inbox.ListAsync(x.Parish, default)).Archived);

        await Assert.ThrowsAsync<DomainException>(() => x.Inbox.StartAsync(x.Parish, Start("Not linked", unlinked), default));
        var direct = await x.Inbox.StartAsync(x.Parish, Start("Your registration", member), default);
        Assert.Equal("Direct", direct.Kind);
        f.As(member, mfa: false);
        Assert.Equal(2, (await x.Inbox.ListAsync(x.Parish, default)).Count);
        Assert.Equal("Office", Assert.Single(await x.Inbox.MessagesAsync(x.Parish, direct.Id, default)).Capacity);
    }

    [Fact]
    public async Task Request_updates_notify_the_applicant_once_and_required_notices_cannot_be_muted()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, mfa: false);
        await x.Notifications.SavePreferencesAsync(new NotificationPreferencesDto { MutedTopics = ["request.update", "community.news"], Language = "fr" }, default);
        var created = await x.Requests.SubmitAsync(x.Parish, new SubmitRequestDto
        {
            OperationId = Guid.NewGuid(), Kind = "Blessing", Summary = "House blessing", Details = new() { ["address"] = "Isolated street" }
        }, default);

        f.As(x.Office);
        var version = (await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<ParishRequest>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "request:" + created.Id, default))!.Version;
        var action = new RequestActionDto { OperationId = Guid.NewGuid(), Version = version, Action = "return", Explanation = "Which day suits you?" };
        await x.Requests.ActAsync(x.Parish, created.Id, action, default);
        await x.Requests.ActAsync(x.Parish, created.Id, action, default);

        f.As(applicant, mfa: false);
        var notice = Assert.Single((await x.Notifications.ListAsync(null, 25, null, default)).Items);
        Assert.Equal(("Required", "Unread"), (notice.Kind, notice.Status));
        Assert.Equal("There is an update to your request.", notice.Title);
        Assert.Equal("Read", (await x.Notifications.SetStateAsync(notice.Id, new NotificationStateDto { Status = "Read" }, default)).Status);
        Assert.Empty((await x.Notifications.ListAsync("Unread", 25, null, default)).Items);

        await x.Notifications.NotifyAsync(applicant, x.Parish, "community.news", "Optional parish news", null, required: false, "news:1", default);
        Assert.Single((await x.Notifications.ListAsync(null, 25, null, default)).Items);
        Assert.Equal("fr", (await x.Notifications.PreferencesAsync(default)).Language);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "requests"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        var office = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(office), Allows = [Permissions.CommunicationsManage, Permissions.RequestsManage], StartsAt = f.Clock.Now
        }, default);
        return new Setup(f, staff, appointment.Id, office);
    }

    private static async Task<string> LinkedMemberAsync(Setup x)
    {
        var account = await x.F.CreateVerifiedMemberAsync();
        x.F.AsAppointment(x.F.Other, x.Appointment);
        var person = await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Parishioner", BirthDate = new DateOnly(1980, 1, 1)
        }, default);
        await x.F.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), PersonId = Guid.Parse(person.Id), EvidenceReference = "Isolated reviewed identity"
        }, default);
        return account;
    }

    private static StartConversationDto Start(string subject, string? recipient = null) => new()
    {
        OperationId = Guid.NewGuid(), Subject = subject, Body = subject + " body", RecipientAccountId = recipient is null ? null : Guid.Parse(recipient)
    };
}
