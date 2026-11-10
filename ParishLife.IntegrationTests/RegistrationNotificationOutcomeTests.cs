// Purpose: verifies registration decision notices and safe outcome projections against actual isolated source/account transactions.
// Main tests: stale decisions create no work; recipient failure leaves a committed waitlist decision Pending until actorless retry;
// offers use real deadlines, own cancellation/reinstatement/confirmation preserve actual outcomes, office entry guesses no recipient,
// and HTTP outcome reads retain management/own/recovery boundaries without exposing internal work or private form evidence.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Registrations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RegistrationNotificationOutcomeTests
{
    private const string PrivateAnswer = "Private isolated registration answer";

    private sealed record Setup(LocalBackendFixture F, SchedulingScenario S, string EventId, string DoorAccount)
    {
        internal string Parish => S.Parish;
        internal RegistrationService Registrations => F.Services.GetRequiredService<RegistrationService>();
        internal IRecordTransactions Records => F.Services.GetRequiredService<IRecordTransactions>();
        internal RecordScope Scope => new() { Area = RecordArea.Parish, OwnerId = Parish };
        internal string Path => $"/api/parishes/{Parish}/calendar/events/{EventId}";
    }

    [Fact]
    public async Task Committed_waitlist_notice_survives_recipient_failure_then_offer_deadline_and_own_actions_report_the_actual_batch()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        f.As(member.Account, false);
        var submitted = await RegisterOwnAsync(x);
        Assert.Equal("NotRequired", submitted.NotificationOutcome!.Status);
        var blocker = await RegisterOfficeAsync(x, await PersonAsync(x));
        await ActAsync(x, blocker.Id, "confirm");
        x.S.Use();
        var before = await RowAsync(x, submitted.Id);
        var stale = new RegistrationActionDto { OperationId = Guid.NewGuid(), Version = "\"stale\"", Action = "confirm", Reason = "Isolated stale decision" };
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Registrations.ActAsync(x.Parish, x.EventId, submitted.Id, stale, default))).Code);
        Assert.Equal(before.Version, (await RowAsync(x, submitted.Id)).Version);
        Assert.Empty(await WorksAsync(x));

        var brokenNotices = ActivatorUtilities.CreateInstance<NotificationService>(f.Services, new NotificationRecipientFaultRecords(x.Records));
        var producer = ActivatorUtilities.CreateInstance<RegistrationService>(f.Services, brokenNotices);
        x.S.Use();
        var decision = new RegistrationActionDto
        {
            OperationId = Guid.NewGuid(), Version = before.Version, Action = "confirm", Reason = "Private isolated staff decision"
        };
        var waitlisted = await producer.ActAsync(x.Parish, x.EventId, submitted.Id, decision, default);
        Assert.Equal("Waitlisted", waitlisted.Status);
        var workId = Assert.Single(waitlisted.NotificationWorkIds!);
        var work = Assert.Single(await WorksAsync(x));
        Assert.Equal((member.Account, "Pending", workId), (work.AccountId, work.Status, work.Id));
        Assert.DoesNotContain("Private isolated", JsonSerializer.Serialize(work));
        f.As(member.Account, false);
        Assert.Equal("Pending", (await x.Registrations.OwnAsync(x.Parish, x.EventId, default)).Value.NotificationOutcome!.Status);
        f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(x.Parish, work.Id, default);
        x.S.Use();
        var replay = await producer.ActAsync(x.Parish, x.EventId, submitted.Id, decision, default);
        Assert.Equal("Stored", (await x.Registrations.StaffViewAsync(replay, default)).NotificationOutcome!.Status);
        Assert.Single(await WorksAsync(x));

        await ActAsync(x, blocker.Id, "cancel");
        x.S.Use();
        var waitingVersion = (await RowAsync(x, submitted.Id)).Version;
        var eventStart = (await x.S.Calendar.GetAsync(x.Parish, x.EventId, default)).Value.StartsAt;
        Assert.Equal("offer_deadline_required", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, submitted.Id, "offer", eventStart))).Code);
        Assert.Equal(waitingVersion, (await RowAsync(x, submitted.Id)).Version);
        Assert.Single(await WorksAsync(x));
        var deadline = f.Clock.Now.AddHours(1);
        var offered = await ActAsync(x, submitted.Id, "offer", deadline);
        Assert.Equal(("Reserved", (DateTimeOffset?)deadline), (offered.Status, offered.OfferUntil));
        Assert.NotEqual(workId, Assert.Single(offered.NotificationWorkIds!));
        f.As(member.Account, false);
        var mine = await x.Registrations.OwnAsync(x.Parish, x.EventId, default);
        Assert.Equal("Stored", mine.Value.NotificationOutcome!.Status);
        var cancelled = await x.Registrations.CancelOwnAsync(x.Parish, x.EventId, new CancelOwnRegistrationDto
        {
            OperationId = Guid.NewGuid(), Version = mine.Version, Reason = "Private isolated schedule conflict"
        }, default);
        Assert.Equal(("Cancelled", "Stored"), (cancelled.Status, cancelled.NotificationOutcome!.Status));
        await ActAsync(x, submitted.Id, "reinstate");
        await ActAsync(x, submitted.Id, "reserve", f.Clock.Now.AddHours(2));
        var confirmed = await ActAsync(x, submitted.Id, "confirm");
        x.S.Use();
        var lastId = Assert.Single(confirmed.NotificationWorkIds!);
        await x.Registrations.AmendAsync(x.Parish, x.EventId, submitted.Id, new AmendParticipantDto
        {
            OperationId = Guid.NewGuid(), Version = (await RowAsync(x, submitted.Id)).Version, Answers = Answers(),
            IndependentDeparture = true, Reason = "Isolated arrangement review"
        }, default);
        Assert.Equal(lastId, Assert.Single((await RowAsync(x, submitted.Id)).Value.NotificationWorkIds!));
        Assert.Equal("Stored", (await x.Registrations.NotificationOutcomeAsync(x.Parish, x.EventId, submitted.Id, default)).Status);
        f.As(member.Account, false);
        var notices = (await f.Services.GetRequiredService<NotificationService>().ListAsync(null, 25, null, default)).Items;
        Assert.All(notices, notice =>
        {
            Assert.Equal("registration.update", notice.Topic);
            Assert.DoesNotContain(PrivateAnswer, notice.Title);
            Assert.Equal(x.Path + "/registrations/mine", notice.Link);
        });
    }

    [Fact]
    public async Task Office_entry_never_guesses_a_notification_recipient_and_legacy_unknown_stays_unknown()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        var office = await RegisterOfficeAsync(x, member.Person);
        var confirmed = await ActAsync(x, office.Id, "confirm");
        Assert.Equal("Office", confirmed.Origin);
        Assert.Empty(confirmed.NotificationWorkIds!);
        Assert.Empty(await WorksAsync(x));
        f.As(member.Account, false);
        Assert.Equal("NotRequired", (await x.Registrations.OwnAsync(x.Parish, x.EventId, default)).Value.NotificationOutcome!.Status);
        var row = await RowAsync(x, office.Id);
        row.Value.NotificationWorkIds = null;
        await x.Records.CommitAsync(x.Scope, Operation.Create(Guid.NewGuid(), "isolated-operator", new { row.Value.Id }, f.Clock),
            "test.legacy-registration", row.Value.Id, [RecordChange.Replace("registration:" + row.Value.Id, "registration", row.Value, row.Version)], row.Value, default);
        f.As(member.Account, false);
        var legacyVersion = (await RowAsync(x, office.Id)).Version;
        Assert.Equal("NotTracked", (await x.Registrations.OwnAsync(x.Parish, x.EventId, default)).Value.NotificationOutcome!.Status);
        Assert.Equal(legacyVersion, (await RowAsync(x, office.Id)).Version);
        Assert.Empty(await WorksAsync(x));
    }

    [Fact]
    public async Task HTTP_outcomes_keep_own_management_and_recovery_boundaries_and_narrow_door_views_exclude_them()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        var stranger = await LinkedMemberAsync(x);
        f.As(member.Account, false);
        var row = await RegisterOwnAsync(x);
        await ActAsync(x, row.Id, "confirm");
        var workId = Assert.Single((await RowAsync(x, row.Id)).Value.NotificationWorkIds!);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var office = factory.Client();
        using var mine = factory.Client();
        using var unrelated = factory.Client();
        using var door = factory.Client();
        using var anonymous = factory.Client();
        await MinistryHttpTests.LoginAsync(office, "other@fixture.example", mfa: true);
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", x.S.Appointment);
        await MinistryHttpTests.LoginAsync(mine, member.Username);
        await MinistryHttpTests.LoginAsync(unrelated, stranger.Username);
        await MinistryHttpTests.LoginAsync(door, await UsernameAsync(f, x.DoorAccount), mfa: true);
        var outcomePath = x.Path + "/registrations/" + row.Id + "/notification-outcome";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(outcomePath)).StatusCode);
        Assert.False((await mine.GetAsync(outcomePath)).IsSuccessStatusCode);
        Assert.False((await unrelated.GetAsync(outcomePath)).IsSuccessStatusCode);
        Assert.False((await door.GetAsync(outcomePath)).IsSuccessStatusCode);
        Assert.False((await unrelated.GetAsync(x.Path + "/registrations/mine/notification-outcome")).IsSuccessStatusCode);
        foreach (var response in new[] { await office.GetAsync(outcomePath), await mine.GetAsync(x.Path + "/registrations/mine/notification-outcome") })
        {
            var outcome = await MinistryHttpTests.ReadAsync<JsonElement>(response);
            Assert.Equal("Stored", outcome.GetProperty("status").GetString());
            Assert.Equal(new[] { "meaning", "status" }, outcome.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
            Assert.DoesNotContain(workId, outcome.GetRawText());
        }
        var ownJson = await (await mine.GetAsync(x.Path + "/registrations/mine")).Content.ReadAsStringAsync();
        Assert.DoesNotContain(workId, ownJson);
        Assert.DoesNotContain("notificationWorkIds", ownJson);
        var doorJson = await (await door.GetAsync(x.Path + "/registrations/" + row.Id + "/door")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("notificationOutcome", doorJson);
        Assert.DoesNotContain(workId, doorJson);

        office.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        var codes = await MinistryHttpTests.ReadAsync<MfaRecoveryCodesDto>(await office.PostAsJsonAsync("/api/auth/mfa/recovery-codes", new RegenerateRecoveryCodesDto
        {
            OperationId = Guid.NewGuid(), CurrentPassword = "isolated-fixture-long-password", CurrentCode = TestAuthenticator.Code()
        }));
        await MinistryHttpTests.CsrfAsync(office);
        var challenge = (await MinistryHttpTests.ReadAsync<JsonElement>(await office.PostAsJsonAsync("/api/auth/login",
            new { username = "other@fixture.example", password = "isolated-fixture-long-password" }))).GetProperty("challenge");
        await MinistryHttpTests.ReadAsync<RecoverySignInDto>(await office.PostAsJsonAsync("/api/auth/login/mfa/recovery", new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(f.Other), Challenge = challenge.GetProperty("challenge").GetString()!, RecoveryCode = codes.RecoveryCodes[0]
        }));
        Assert.Equal(HttpStatusCode.Forbidden, (await office.GetAsync(outcomePath)).StatusCode);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows:
        [Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.RegistrationsManage, Permissions.PeopleRead, Permissions.PeopleWrite]));
        var scheduling = new SchedulingScenario(staff, appointment.Id);
        var door = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(door), Allows = [Permissions.CheckIn], StartsAt = f.Clock.Now
        }, default);
        var occurrence = await scheduling.EventAsync(f.Clock.Now.AddDays(7), title: "Private isolated event title");
        await scheduling.EventActionAsync(occurrence.Id, "confirm");
        var x = new Setup(f, scheduling, occurrence.Id, door);
        scheduling.Use();
        await x.Registrations.ConfigureAsync(x.Parish, x.EventId, new ConfigureRegistrationDto
        {
            OperationId = Guid.NewGuid(), Capacity = 1, TransportCapacity = 0, Fee = 0m, Currency = "USD", Precision = 2,
            WaitlistAllowed = true, MinimumAge = 0, MaximumAge = 120, ChildAgeThreshold = 16, ConsentRequired = false,
            DoorAccountIds = [Guid.Parse(door)], Fields = [new RegistrationField { Key = "answer", Label = "Isolated question", Type = "Text" }]
        }, default);
        scheduling.Use();
        await x.Registrations.PolicyActionAsync(x.Parish, x.EventId, new RegistrationPolicyActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Registrations.PolicyAsync(x.Parish, x.EventId, default)).Version, Action = "open"
        }, default);
        return x;
    }

    private static async Task<string> PersonAsync(Setup x)
    {
        x.S.Use();
        return (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Participant", BirthDate = new DateOnly(1990, 1, 1)
        }, default)).Id;
    }

    private static async Task<(string Account, string Person, string Username)> LinkedMemberAsync(Setup x)
    {
        var account = await x.F.CreateVerifiedMemberAsync();
        var person = await PersonAsync(x);
        x.S.Use();
        await x.F.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity"
        }, default);
        return (account, person, await UsernameAsync(x.F, account));
    }

    private static Dictionary<string, string> Answers() => new() { ["answer"] = PrivateAnswer };

    private static async Task<EventRegistrationDto> RegisterOwnAsync(Setup x)
        => await x.Registrations.RegisterOwnAsync(x.Parish, x.EventId, new RegisterOwnDto
        {
            OperationId = Guid.NewGuid(), FormVersionId = Guid.Parse((await x.Registrations.ApplicantFormAsync(x.Parish, x.EventId, default)).FormVersionId), Answers = Answers()
        }, default);

    private static async Task<EventRegistration> RegisterOfficeAsync(Setup x, string person)
    {
        x.S.Use();
        var policy = await x.Registrations.PolicyAsync(x.Parish, x.EventId, default);
        var form = await x.Registrations.FormAsync(x.Parish, x.EventId, policy.Value.FormVersionId, default);
        return await x.Registrations.RegisterAsync(x.Parish, x.EventId, new RegisterParticipantDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(person), FormVersionId = Guid.Parse(form.Id), Answers = Answers(), IndependentDeparture = true
        }, default);
    }

    private static async Task<EventRegistration> ActAsync(Setup x, string id, string action, DateTimeOffset? until = null)
    {
        x.S.Use();
        return await x.Registrations.ActAsync(x.Parish, x.EventId, id, new RegistrationActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await RowAsync(x, id)).Version, Action = action, OfferUntil = until, Reason = "Isolated reviewed registration decision"
        }, default);
    }

    private static async Task<Versioned<EventRegistration>> RowAsync(Setup x, string id)
        => (await x.Records.ReadAsync<EventRegistration>(x.Scope, "registration:" + id, default))!;

    private static async Task<NotificationWork[]> WorksAsync(Setup x)
        => (await x.Records.PageAsync<NotificationWork>(x.Scope, "notificationWork", 100, null, default)).Items.Select(row => row.Value).ToArray();

    private static async Task<string> UsernameAsync(LocalBackendFixture f, string account)
        => (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(account))!.UserName!;
}
