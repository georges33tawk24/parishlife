// Purpose: verifies registration lifecycle eligibility, viewed-form integrity and restricted door/cashier HTTP workflows in isolated storage.
// Main tests: draft calendar changes cannot bypass event eligibility; stale form answers require review; narrow MFA roles obtain usable
// versions and complete their own workflows without access to registration answers, private evidence or broader management routes.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Registrations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RegistrationIntegrityTests
{
    private const string PrivateAnswer = "isolated private application answer";
    private const string ConsentEvidence = "isolated private consent evidence";
    private const string GuardianEvidence = "isolated private guardian evidence";
    private const string CollectorEvidence = "isolated private collector authority";

    private sealed record Setup(LocalBackendFixture Fixture, SchedulingScenario Scheduling, CalendarEventDto Event,
        string DoorAccount, string UnassignedAccount, string CashierAccount)
    {
        internal string Parish => Scheduling.Parish;
        internal RegistrationService Service => Fixture.Services.GetRequiredService<RegistrationService>();
        internal string Path => $"/api/parishes/{Parish}/calendar/events/{Event.Id}";
    }

    [Theory]
    [InlineData("ParishActivity", "Private")]
    [InlineData("Appointment", "Private")]
    [InlineData("ResourceBlock", "Private")]
    public async Task A_policy_configured_on_an_eligible_draft_cannot_open_after_the_calendar_changes_kind_or_audience(string kind, string visibility)
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var x = await CreateAsync(fixture, confirmed: false);
        await ConfigureAsync(x);
        x.Scheduling.Use();
        var current = await x.Scheduling.Calendar.GetAsync(x.Parish, x.Event.Id, default);
        await x.Scheduling.Calendar.SaveAsync(x.Parish, x.Event.Id, new SaveEventDto
        {
            OperationId = Guid.NewGuid(), Version = current.Version, Title = "Changed draft", Kind = kind, Visibility = visibility,
            StartsAt = x.Event.StartsAt, EndsAt = x.Event.EndsAt, TimeZone = x.Event.TimeZone
        }, default);
        await x.Scheduling.EventActionAsync(x.Event.Id, "confirm");
        x.Scheduling.Use();
        var failure = await Assert.ThrowsAsync<DomainException>(() => OpenAsync(x));
        Assert.Equal("event_not_eligible", failure.Code);
        Assert.Equal(FailureKind.Conflict, failure.Kind);
        x.Scheduling.Use();
        Assert.Equal("Draft", (await x.Service.PolicyAsync(x.Parish, x.Event.Id, default)).Value.Status);
        Assert.Empty((await x.Service.ListAsync(x.Parish, x.Event.Id, 25, null, default)).Items);
    }

    [Fact]
    public async Task Office_and_self_submissions_must_identify_the_form_they_viewed_and_existing_answers_keep_that_version()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var x = await CreateAsync(fixture);
        await ConfigureAsync(x);
        await OpenAsync(x);
        var officePerson = await PersonAsync(x, child: false);
        var member = await LinkedMemberAsync(x);
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var office = factory.Client();
        using var applicant = factory.Client();
        await MinistryHttpTests.LoginAsync(office, "other@fixture.example", mfa: true);
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", x.Scheduling.Appointment);
        await MinistryHttpTests.LoginAsync(applicant, member.Username);
        var viewed = await MinistryHttpTests.ReadAsync<RegistrationApplicantFormDto>(await applicant.GetAsync(x.Path + "/registration/applicant-form"));
        var officeViewed = await MinistryHttpTests.ReadAsync<RegistrationFormDto>(await office.GetAsync(x.Path + "/registration/forms/" + viewed.FormVersionId));
        Assert.Equal(viewed.FormVersionId, officeViewed.Id);
        Assert.Equal("Isolated approved event consent wording", viewed.ConsentText);
        Assert.True(viewed.ConsentRequired);
        var applicantJson = await (await applicant.GetAsync(x.Path + "/registration/applicant-form")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("doorAccountIds", applicantJson);
        Assert.DoesNotContain("createdBy", applicantJson);
        Assert.False((await applicant.GetAsync(x.Path + "/registration")).IsSuccessStatusCode);

        var policy = await MinistryHttpTests.ReadAsync<Versioned<RegistrationPolicyDto>>(await office.GetAsync(x.Path + "/registration"));
        var revised = await MinistryHttpTests.ReadAsync<RegistrationPolicyDto>(await office.PostAsJsonAsync(x.Path + "/registration/forms", new ReviseFormDto
        {
            OperationId = Guid.NewGuid(), Version = policy.Version, Fields = Fields("Reviewed question version two")
        }));
        var officeRequest = new RegisterParticipantDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(officePerson), FormVersionId = Guid.Parse(viewed.FormVersionId),
            Answers = Answers(), ConsentEvidence = ConsentEvidence, IndependentDeparture = true
        };
        var ownRequest = new RegisterOwnDto
        {
            OperationId = Guid.NewGuid(), FormVersionId = Guid.Parse(viewed.FormVersionId), Answers = Answers(), ConsentEvidence = ConsentEvidence
        };
        foreach (var response in new[]
        {
            await office.PostAsJsonAsync(x.Path + "/registrations", officeRequest),
            await applicant.PostAsJsonAsync(x.Path + "/registrations/mine", ownRequest)
        })
        {
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("registration_form_changed", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString());
        }
        Assert.Empty((await MinistryHttpTests.ReadAsync<Page<Versioned<EventRegistrationDto>>>(await office.GetAsync(x.Path + "/registrations"))).Items);
        Assert.Equal(HttpStatusCode.BadRequest, (await applicant.PostAsJsonAsync(x.Path + "/registrations/mine", new RegisterOwnDto
        {
            OperationId = Guid.NewGuid(), Answers = Answers()
        })).StatusCode);

        var refreshed = await MinistryHttpTests.ReadAsync<RegistrationApplicantFormDto>(await applicant.GetAsync(x.Path + "/registration/applicant-form"));
        Assert.Equal(revised.FormVersionId, refreshed.FormVersionId);
        Assert.Equal("Reviewed question version two", Assert.Single(refreshed.Fields).Label);
        var officeRefreshed = await MinistryHttpTests.ReadAsync<RegistrationFormDto>(await office.GetAsync(x.Path + "/registration/forms/" + refreshed.FormVersionId));
        officeRequest.FormVersionId = Guid.Parse(officeRefreshed.Id);
        ownRequest.FormVersionId = Guid.Parse(refreshed.FormVersionId);
        var officeRegistration = await MinistryHttpTests.ReadAsync<EventRegistrationDto>(await office.PostAsJsonAsync(x.Path + "/registrations", officeRequest));
        var ownRegistration = await MinistryHttpTests.ReadAsync<EventRegistrationDto>(await applicant.PostAsJsonAsync(x.Path + "/registrations/mine", ownRequest));
        Assert.Equal(refreshed.FormVersionId, officeRegistration.FormVersionId);
        Assert.Equal(refreshed.FormVersionId, ownRegistration.FormVersionId);
        policy = await MinistryHttpTests.ReadAsync<Versioned<RegistrationPolicyDto>>(await office.GetAsync(x.Path + "/registration"));
        await MinistryHttpTests.ReadAsync<RegistrationPolicyDto>(await office.PostAsJsonAsync(x.Path + "/registration/forms", new ReviseFormDto
        {
            OperationId = Guid.NewGuid(), Version = policy.Version, Fields = Fields("Reviewed question version three")
        }));
        Assert.Equal(refreshed.FormVersionId, (await MinistryHttpTests.ReadAsync<Versioned<EventRegistrationDto>>(
            await applicant.GetAsync(x.Path + "/registrations/mine"))).Value.FormVersionId);
        var oldForm = await MinistryHttpTests.ReadAsync<RegistrationFormDto>(await office.GetAsync(x.Path + "/registration/forms/" + refreshed.FormVersionId));
        Assert.Equal("Reviewed question version two", Assert.Single(oldForm.Fields).Label);
    }

    [Fact]
    public async Task Assigned_checkin_and_cashier_only_accounts_use_versioned_HTTP_projections_without_sensitive_registration_access()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var x = await CreateAsync(fixture);
        await ConfigureAsync(x);
        await OpenAsync(x);
        var confirmed = await RegisterAsync(x, await PersonAsync(x, child: true), child: true);
        x.Scheduling.Use();
        await x.Service.ActAsync(x.Parish, x.Event.Id, confirmed.Id, new RegistrationActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Service.GetAsync(x.Parish, x.Event.Id, confirmed.Id, default)).Version,
            Action = "confirm", Reason = "Isolated approved participant"
        }, default);
        var submitted = await RegisterAsync(x, await PersonAsync(x, child: false), child: false);
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var door = factory.Client();
        using var unassigned = factory.Client();
        using var cashier = factory.Client();
        using var anonymous = factory.Client();
        await MinistryHttpTests.LoginAsync(door, await UsernameAsync(fixture, x.DoorAccount), mfa: true);
        await MinistryHttpTests.LoginAsync(unassigned, await UsernameAsync(fixture, x.UnassignedAccount), mfa: true);
        await MinistryHttpTests.LoginAsync(cashier, await UsernameAsync(fixture, x.CashierAccount), mfa: true);
        var rowPath = x.Path + "/registrations/" + confirmed.Id;
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(x.Path + "/registrations/door")).StatusCode);
        Assert.False((await unassigned.GetAsync(x.Path + "/registrations/door")).IsSuccessStatusCode);
        Assert.False((await unassigned.GetAsync(rowPath + "/door")).IsSuccessStatusCode);
        Assert.False((await cashier.GetAsync(rowPath + "/door")).IsSuccessStatusCode);
        Assert.False((await door.GetAsync(rowPath + "/cashier")).IsSuccessStatusCode);
        foreach (var client in new[] { door, cashier })
        {
            Assert.False((await client.GetAsync(x.Path + "/registrations")).IsSuccessStatusCode);
            Assert.False((await client.GetAsync(rowPath)).IsSuccessStatusCode);
            Assert.False((await client.GetAsync(x.Path + "/registration")).IsSuccessStatusCode);
        }

        var doorResponse = await door.GetAsync(x.Path + "/registrations/door");
        var doorJson = await doorResponse.Content.ReadAsStringAsync();
        AssertPrivateDataAbsent(doorJson);
        Assert.DoesNotContain("fee", doorJson);
        Assert.DoesNotContain("received", doorJson);
        var participant = Assert.Single((await MinistryHttpTests.ReadAsync<Page<Versioned<DoorRegistrationDto>>>(doorResponse)).Items);
        Assert.Equal(confirmed.Id, participant.Value.Id);
        Assert.Equal("collector-1", Assert.Single(participant.Value.Collectors).Id);
        Assert.False(string.IsNullOrWhiteSpace(participant.Version));
        Assert.Equal(HttpStatusCode.NotFound, (await door.GetAsync(x.Path + "/registrations/" + submitted.Id + "/door")).StatusCode);
        door.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await door.PostAsJsonAsync(rowPath + "/presence", new RecordPresenceDto
        {
            OperationId = Guid.NewGuid(), Version = participant.Version, Action = "arrive", OccurredAt = DateTimeOffset.UtcNow
        })).StatusCode);
        await MinistryHttpTests.CsrfAsync(door);
        await MinistryHttpTests.ReadAsync<PresenceChangeDto>(await door.PostAsJsonAsync(rowPath + "/presence", new RecordPresenceDto
        {
            OperationId = Guid.NewGuid(), Version = participant.Version, Action = "arrive", OccurredAt = DateTimeOffset.UtcNow
        }));
        participant = await MinistryHttpTests.ReadAsync<Versioned<DoorRegistrationDto>>(await door.GetAsync(rowPath + "/door"));
        Assert.Equal("Present", participant.Value.Presence);
        Assert.Equal(HttpStatusCode.Forbidden, (await door.PostAsJsonAsync(rowPath + "/presence", new RecordPresenceDto
        {
            OperationId = Guid.NewGuid(), Version = participant.Version, Action = "checkout", OccurredAt = DateTimeOffset.UtcNow
        })).StatusCode);
        await MinistryHttpTests.ReadAsync<PresenceChangeDto>(await door.PostAsJsonAsync(rowPath + "/presence", new RecordPresenceDto
        {
            OperationId = Guid.NewGuid(), Version = participant.Version, Action = "checkout", OccurredAt = DateTimeOffset.UtcNow,
            CollectorId = participant.Value.Collectors[0].Id, VerificationEvidence = "Isolated actual collector ID verification"
        }));
        Assert.Equal("Departed", (await MinistryHttpTests.ReadAsync<Versioned<DoorRegistrationDto>>(await door.GetAsync(rowPath + "/door"))).Value.Presence);

        var cashierResponse = await cashier.GetAsync(x.Path + "/registrations/cashier");
        var cashierJson = await cashierResponse.Content.ReadAsStringAsync();
        AssertPrivateDataAbsent(cashierJson);
        Assert.DoesNotContain("collectors", cashierJson);
        Assert.DoesNotContain("presence", cashierJson);
        Assert.Equal(2, (await MinistryHttpTests.ReadAsync<Page<Versioned<CashierRegistrationDto>>>(cashierResponse)).Items.Count);
        var balance = await MinistryHttpTests.ReadAsync<Versioned<CashierRegistrationDto>>(await cashier.GetAsync(rowPath + "/cashier"));
        Assert.Equal(10m, balance.Value.Outstanding);
        await MinistryHttpTests.ReadAsync<RegistrationMovementDto>(await cashier.PostAsJsonAsync(rowPath + "/receipts", new RecordEventReceiptDto
        {
            OperationId = Guid.NewGuid(), Version = balance.Version, Amount = 4m, Currency = balance.Value.Currency,
            OccurredAt = DateTimeOffset.UtcNow, EvidenceReference = "Isolated actual cash receipt"
        }));
        Assert.Equal(HttpStatusCode.Conflict, (await cashier.PostAsJsonAsync(rowPath + "/receipts", new RecordEventReceiptDto
        {
            OperationId = Guid.NewGuid(), Version = balance.Version, Amount = 1m, Currency = balance.Value.Currency,
            OccurredAt = DateTimeOffset.UtcNow, EvidenceReference = "Isolated stale cash receipt"
        })).StatusCode);
        balance = await MinistryHttpTests.ReadAsync<Versioned<CashierRegistrationDto>>(await cashier.GetAsync(rowPath + "/cashier"));
        Assert.Equal(4m, balance.Value.Received);
        Assert.Equal(6m, balance.Value.Outstanding);
        var refund = await MinistryHttpTests.ReadAsync<RegistrationRefundDto>(await cashier.PostAsJsonAsync(rowPath + "/refunds", new RequestEventRefundDto
        {
            OperationId = Guid.NewGuid(), Version = balance.Version, Amount = 2m, Reason = "Isolated reviewed refund request"
        }));
        Assert.Equal("Requested", refund.Status);
        Assert.False((await cashier.GetAsync(rowPath + "/movements")).IsSuccessStatusCode);
    }

    private static void AssertPrivateDataAbsent(string json)
    {
        foreach (var value in new[] { PrivateAnswer, ConsentEvidence, GuardianEvidence, CollectorEvidence,
            "answers", "consentEvidence", "guardianAuthorityEvidence", "authorityEvidence", "createdBy" })
            Assert.DoesNotContain(value, json);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture fixture, bool confirmed = true)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(fixture);
        await staff.ActivateOfficeAsync(["core", "office", "finance"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(fixture.Other, allows:
        [
            Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.SchedulePublish,
            Permissions.RegistrationsManage, Permissions.PeopleRead, Permissions.PeopleWrite
        ]));
        var scheduling = new SchedulingScenario(staff, appointment.Id);
        var door = await fixture.CreateVerifiedStaffAsync();
        var unassigned = await fixture.CreateVerifiedStaffAsync();
        var cashier = await fixture.CreateVerifiedStaffAsync();
        await GrantAsync(staff, door, [Permissions.CheckIn]);
        await GrantAsync(staff, unassigned, [Permissions.CheckIn]);
        await GrantAsync(staff, cashier, [Permissions.FinanceEnter]);
        var occurrence = await scheduling.EventAsync(fixture.Clock.Now.AddMinutes(20));
        if (confirmed)
            occurrence = await scheduling.EventActionAsync(occurrence.Id, "confirm");
        return new Setup(fixture, scheduling, occurrence, door, unassigned, cashier);
    }

    private static async Task GrantAsync(StaffAppointmentScenario staff, string account, string[] allows)
    {
        staff.Fixture.As(staff.Fixture.FirstAdmin);
        await staff.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(account), Allows = allows, StartsAt = staff.Fixture.Clock.Now
        }, default);
    }

    private static async Task ConfigureAsync(Setup x)
    {
        x.Scheduling.Use();
        await x.Service.ConfigureAsync(x.Parish, x.Event.Id, new ConfigureRegistrationDto
        {
            OperationId = Guid.NewGuid(), Capacity = 20, TransportCapacity = 0, Fee = 10m, Currency = "USD", Precision = 2,
            WaitlistAllowed = true, MinimumAge = 0, MaximumAge = 120, ChildAgeThreshold = 16,
            ConsentRequired = true, ConsentText = "Isolated approved event consent wording", DoorAccountIds = [Guid.Parse(x.DoorAccount)],
            Fields = Fields("Reviewed question version one")
        }, default);
    }

    private static async Task OpenAsync(Setup x)
    {
        x.Scheduling.Use();
        await x.Service.PolicyActionAsync(x.Parish, x.Event.Id, new RegistrationPolicyActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Service.PolicyAsync(x.Parish, x.Event.Id, default)).Version, Action = "open"
        }, default);
    }

    private static RegistrationField[] Fields(string label) => [new RegistrationField { Key = "detail", Label = label, Type = "Text", Required = true }];

    private static Dictionary<string, string> Answers() => new() { ["detail"] = PrivateAnswer };

    private static async Task<string> PersonAsync(Setup x, bool child)
    {
        x.Scheduling.Use();
        return (await x.Fixture.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = child ? "Child participant" : "Adult participant",
            BirthDate = child ? new DateOnly(2018, 5, 1) : new DateOnly(1990, 1, 1)
        }, default)).Id;
    }

    private static async Task<(string AccountId, string Username)> LinkedMemberAsync(Setup x)
    {
        var account = await x.Fixture.CreateVerifiedMemberAsync();
        var person = await PersonAsync(x, child: false);
        x.Scheduling.Use();
        await x.Fixture.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity"
        }, default);
        return (account, await UsernameAsync(x.Fixture, account));
    }

    private static async Task<EventRegistration> RegisterAsync(Setup x, string person, bool child)
    {
        x.Scheduling.Use();
        var policy = await x.Service.PolicyAsync(x.Parish, x.Event.Id, default);
        var form = await x.Service.FormAsync(x.Parish, x.Event.Id, policy.Value.FormVersionId, default);
        return await x.Service.RegisterAsync(x.Parish, x.Event.Id, new RegisterParticipantDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(person), FormVersionId = Guid.Parse(form.Id), Answers = Answers(),
            ConsentEvidence = ConsentEvidence, GuardianAuthorityEvidence = child ? GuardianEvidence : null, IndependentDeparture = !child,
            Collectors = child ? [new AuthorizedCollector { Id = "collector-1", Name = "Isolated authorized collector", AuthorityEvidence = CollectorEvidence }] : []
        }, default);
    }

    private static async Task<string> UsernameAsync(LocalBackendFixture fixture, string account)
        => (await fixture.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(account))!.UserName!;
}
