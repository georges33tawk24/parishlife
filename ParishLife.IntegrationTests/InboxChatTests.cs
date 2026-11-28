// Purpose: verifies the chat-app behaviour of the parish inbox through real local services and storage: one chat per person, the delivered
// and read ticks, voice notes (checked by content, private to the conversation) and voice/video calls (one person, rung only where online).
// Main tests: A_second_message_to_the_same_person_joins_their_chat, Ticks_follow_the_other_side, Voice_notes_are_checked_and_private,
// Calls_ring_one_person_and_leave_a_missed_call.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class InboxChatTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Office)
    {
        public InboxService Inbox => F.Services.GetRequiredService<InboxService>();
        public CallService Calls => F.Services.GetRequiredService<CallService>();
        public LiveHub Live => F.Services.GetRequiredService<LiveHub>();
        public string Parish => Staff.Parish;
    }

    // A minimal WebM (EBML) header is enough for the content check; the API never decodes audio.
    private static readonly byte[] Webm = [0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01];

    [Fact]
    public async Task A_second_message_to_the_same_person_joins_their_chat()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);

        f.As(member, mfa: false);
        var first = await x.Inbox.StartAsync(x.Parish, Start(null, "Hello father\nsecond line"), default);
        Assert.Equal("Hello father", first.Subject); // no subject: the first line names the chat
        var again = await x.Inbox.StartAsync(x.Parish, Start("Another topic", "Me again"), default);
        Assert.Equal(first.Id, again.Id);
        Assert.Single(await x.Inbox.ListAsync(x.Parish, default));
        Assert.Equal(2, (await x.Inbox.MessagesAsync(x.Parish, first.Id, default)).Count);

        f.As(x.Office);
        var direct = await x.Inbox.StartAsync(x.Parish, Start("Registration", "Hi", member), default);
        var start = Start("Registration", "Following up", member);
        var joined = await x.Inbox.StartAsync(x.Parish, start, default);
        Assert.Equal(direct.Id, joined.Id);
        Assert.Equal(direct.Id, (await x.Inbox.StartAsync(x.Parish, start, default)).Id); // the same operation replays
        Assert.Equal(2, (await x.Inbox.MessagesAsync(x.Parish, direct.Id, default)).Count);

        // Archived on one side, a new message brings the chat back for that participant.
        f.As(member, mfa: false);
        Assert.True((await x.Inbox.ArchiveAsync(x.Parish, direct.Id, true, default)).Archived);
        f.As(x.Office);
        await x.Inbox.PostAsync(x.Parish, direct.Id, new PostInboxMessageDto { OperationId = Guid.NewGuid(), Body = "Are you there?" }, default);
        f.As(member, mfa: false);
        Assert.False((await x.Inbox.ListAsync(x.Parish, default)).Single(c => c.Id == direct.Id).Archived);
    }

    [Fact]
    public async Task Ticks_follow_the_other_side()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);

        f.As(x.Office);
        var chat = await x.Inbox.StartAsync(x.Parish, Start(null, "Your certificate is ready", member), default);
        var sent = Assert.Single(await x.Inbox.MessagesAsync(x.Parish, chat.Id, default));
        Assert.Equal((false, false), (sent.Delivered, sent.Read));

        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        f.As(member, mfa: false);
        Assert.Single(await x.Inbox.ListAsync(x.Parish, default)); // the member's list showed it
        f.As(x.Office);
        Assert.Equal((true, false), (Assert.Single(await x.Inbox.MessagesAsync(x.Parish, chat.Id, default)).Delivered,
            Assert.Single(await x.Inbox.MessagesAsync(x.Parish, chat.Id, default)).Read));

        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        f.As(member, mfa: false);
        var seenByMember = Assert.Single(await x.Inbox.MessagesAsync(x.Parish, chat.Id, default));
        Assert.Null(seenByMember.Read); // ticks are only on one's own messages
        f.As(x.Office);
        Assert.True(Assert.Single(await x.Inbox.MessagesAsync(x.Parish, chat.Id, default)).Read);

        // A member writing to the office: read once office staff open it.
        f.As(member, mfa: false);
        var office = await x.Inbox.StartAsync(x.Parish, Start(null, "Question for the office"), default);
        Assert.False(Assert.Single(await x.Inbox.MessagesAsync(x.Parish, office.Id, default)).Read);
        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        f.As(x.Office);
        await x.Inbox.MessagesAsync(x.Parish, office.Id, default);
        f.As(member, mfa: false);
        Assert.True(Assert.Single(await x.Inbox.MessagesAsync(x.Parish, office.Id, default)).Read);
    }

    [Fact]
    public async Task Voice_notes_are_checked_and_private()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        var stranger = await f.CreateVerifiedMemberAsync();

        f.As(member, mfa: false);
        var chat = await x.Inbox.StartAsync(x.Parish, Start(null, "Hello"), default);
        await Assert.ThrowsAsync<DomainException>(() => x.Inbox.PostVoiceAsync(x.Parish, chat.Id, Guid.NewGuid(), "%PDF-1.7"u8.ToArray(), 4, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Inbox.PostVoiceAsync(x.Parish, chat.Id, Guid.NewGuid(), Webm, 0, default));
        var operation = Guid.NewGuid();
        var voice = await x.Inbox.PostVoiceAsync(x.Parish, chat.Id, operation, Webm, 7, default);
        Assert.Equal((7, "audio/webm", InboxService.VoiceBody), (voice.VoiceSeconds, voice.VoiceType, voice.Body));
        Assert.Equal(voice.Id, (await x.Inbox.PostVoiceAsync(x.Parish, chat.Id, operation, Webm, 7, default)).Id);

        f.As(x.Office);
        var (content, type) = await x.Inbox.VoiceAsync(x.Parish, chat.Id, voice.Id, default);
        Assert.Equal(Webm, content);
        Assert.Equal("audio/webm", type);
        Assert.Equal(7, (await x.Inbox.MessagesAsync(x.Parish, chat.Id, default)).Single(m => m.Id == voice.Id).VoiceSeconds);

        f.As(stranger, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Inbox.VoiceAsync(x.Parish, chat.Id, voice.Id, default));
    }

    [Fact]
    public async Task Calls_ring_one_person_and_leave_a_missed_call()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);

        f.As(member, mfa: false);
        var office = await x.Inbox.StartAsync(x.Parish, Start(null, "Hello office"), default);
        await Assert.ThrowsAsync<DomainException>(() => x.Calls.PlaceAsync(x.Parish, office.Id, new PlaceCallDto { Sdp = "v=0" }, default));

        f.As(x.Office);
        var chat = await x.Inbox.StartAsync(x.Parish, Start(null, "Hi", member), default);
        f.Clock.Now = f.Clock.Now.AddMinutes(1); // after the greeting
        var offline = await x.Calls.PlaceAsync(x.Parish, chat.Id, new PlaceCallDto { Sdp = "v=0" }, default);
        Assert.False(offline.Ringing);
        Assert.Equal("Missed voice call", (await x.Inbox.MessagesAsync(x.Parish, chat.Id, default)).Last().Body);

        var (tab, events) = x.Live.Subscribe(member);
        var call = await x.Calls.PlaceAsync(x.Parish, chat.Id, new PlaceCallDto { Video = true, Sdp = "v=0 offer" }, default);
        Assert.True(call.Ringing);
        var ring = await events.ReadAsync();
        Assert.Contains("\"type\":\"call\"", ring);
        Assert.Contains("\"video\":true", ring);

        // Only the callee answers; then either side ends it and nothing is stored about an answered call.
        Assert.Throws<DomainException>(() => x.Calls.Answer(call.Id, new AnswerCallDto { Sdp = "v=0 answer" }));
        f.As(member, mfa: false);
        x.Calls.Answer(call.Id, new AnswerCallDto { Sdp = "v=0 answer" });
        await x.Calls.EndAsync(call.Id, new EndCallDto { Reason = "Ended" }, default);
        Assert.Empty(x.Live.Calls);
        Assert.Equal("Missed voice call", (await x.Inbox.MessagesAsync(x.Parish, chat.Id, default)).Last().Body);
        x.Live.Unsubscribe(member, tab);
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

    private static StartConversationDto Start(string? subject, string body, string? recipient = null) => new()
    {
        OperationId = Guid.NewGuid(), Subject = subject, Body = body, RecipientAccountId = recipient is null ? null : Guid.Parse(recipient)
    };
}
