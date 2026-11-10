// Purpose: verifies event registration through real local services, storage, cookies and CSRF after wiring the registration service.
// Main tests: capacity/waitlist/offer and stale-policy rollback; event eligibility and guardian arrangements; independent receipts and
// refunds; assigned door arrival/checkout/reentry; member self-registration with own projection and cancellation; HTTP access.
// Helpers build a parish with scheduling, registration, check-in and separate cashier/approver finance grants.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Registrations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class EventRegistrationTests
{
    private sealed record Setup(LocalBackendFixture F, SchedulingScenario S, string Cashier, string Approver, CalendarEventDto Event)
    {
        public RegistrationService Service => F.Services.GetRequiredService<RegistrationService>();
        public string Parish => S.Parish;
        public string EventId => Event.Id;
    }

    [Fact]
    public async Task Capacity_waitlist_offer_and_reinstatement_follow_the_policy_and_stale_versions_roll_back()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var policy = await ConfigureAsync(x, capacity: 1);
        Assert.Equal("Draft", policy.Status);
        x.S.Use();
        var stale = (await x.Service.PolicyAsync(x.Parish, x.EventId, default)).Version;
        await OpenAsync(x);
        x.S.Use();
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Service.PolicyActionAsync(x.Parish, x.EventId,
            new RegistrationPolicyActionDto { OperationId = Guid.NewGuid(), Version = stale, Action = "close" }, default))).Code);

        var first = await RegisterAsync(x, await PersonAsync(x, new DateOnly(1990, 1, 1)));
        var second = await RegisterAsync(x, await PersonAsync(x, new DateOnly(1991, 1, 1)));
        Assert.Equal("Office", first.Origin);
        Assert.Equal("Confirmed", (await ActAsync(x, first.Id, "confirm")).Status);
        Assert.Equal("Waitlisted", (await ActAsync(x, second.Id, "confirm")).Status);
        Assert.Equal("Cancelled", (await ActAsync(x, first.Id, "cancel")).Status);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, second.Id, "offer"));
        Assert.Equal("Reserved", (await ActAsync(x, second.Id, "offer", f.Clock.Now.AddDays(1))).Status);
        Assert.Equal("Confirmed", (await ActAsync(x, second.Id, "confirm")).Status);
        Assert.Equal("Submitted", (await ActAsync(x, first.Id, "reinstate")).Status);
        // The only seat is taken again, so the reinstated participant waits instead of overbooking.
        Assert.Equal("Waitlisted", (await ActAsync(x, first.Id, "confirm")).Status);
        x.S.Use();
        var rows = (await x.Service.ListAsync(x.Parish, x.EventId, 25, null, default)).Items;
        Assert.Single(rows, r => RegistrationRules.ConsumesSeat(r.Value, f.Clock.Now));
    }

    [Fact]
    public async Task Only_confirmed_parish_activities_open_and_children_need_guardian_and_collection_arrangements()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f, confirm: false);
        await ConfigureAsync(x);
        await Assert.ThrowsAsync<DomainException>(() => OpenAsync(x));
        await x.S.EventActionAsync(x.EventId, "confirm");
        await OpenAsync(x);

        var hidden = await x.S.EventAsync(f.Clock.Now.AddDays(3), visibility: "Private");
        x.S.Use();
        Assert.Equal("event_not_eligible", (await Assert.ThrowsAsync<DomainException>(() => x.Service.ConfigureAsync(x.Parish, hidden.Id,
            Policy(x, 5), default))).Code);

        var child = await RegisterAsync(x, await PersonAsync(x, new DateOnly(2018, 5, 1)));
        Assert.Equal("guardian_authority_required", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, child.Id, "confirm"))).Code);
        x.S.Use();
        await x.Service.AmendAsync(x.Parish, x.EventId, child.Id, new AmendParticipantDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, child.Id), Transport = false,
            GuardianAuthorityEvidence = "Isolated verified guardian authority", Collectors = [Collector()], Reason = "Guardian arrangements recorded"
        }, default);
        Assert.Equal("Confirmed", (await ActAsync(x, child.Id, "confirm")).Status);
    }

    [Fact]
    public async Task Receipts_and_refunds_need_separate_cashier_approver_and_recorder_and_never_exceed_actual_money()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x);
        await OpenAsync(x);
        var row = await RegisterAsync(x, await PersonAsync(x, new DateOnly(1990, 1, 1)));

        x.S.Use();
        await Assert.ThrowsAsync<DomainException>(() => ReceiptAsync(x, row.Id, 10m));
        f.As(x.Cashier);
        Assert.Equal("invalid_event_receipt", (await Assert.ThrowsAsync<DomainException>(() => ReceiptAsync(x, row.Id, 15m))).Code);
        Assert.Equal("CashReceived", (await ReceiptAsync(x, row.Id, 10m)).Kind);

        var refund = await x.Service.RequestRefundAsync(x.Parish, x.EventId, row.Id, new RequestEventRefundDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, row.Id), Amount = 4m, Reason = "Participant left early"
        }, default);
        await Assert.ThrowsAsync<DomainException>(() => RefundActionAsync(x, row.Id, refund.Id, "approve"));
        f.As(x.Approver);
        Assert.Equal("Approved", (await RefundActionAsync(x, row.Id, refund.Id, "approve")).Status);
        await Assert.ThrowsAsync<DomainException>(() => RefundActionAsync(x, row.Id, refund.Id, "record"));
        f.As(x.Cashier);
        Assert.Equal("Recorded", (await RefundActionAsync(x, row.Id, refund.Id, "record")).Status);

        var current = (await x.Service.MovementsAsync(x.Parish, x.EventId, row.Id, 25, null, default)).Items;
        Assert.Equal(["CashReceived", "CashRefunded"], current.Select(m => m.Value.Kind).Order(StringComparer.Ordinal));
        x.S.Use();
        var balance = (await x.Service.GetAsync(x.Parish, x.EventId, row.Id, default)).Value;
        Assert.Equal(10m, balance.Received);
        Assert.Equal(4m, balance.Refunded);
    }

    [Fact]
    public async Task Assigned_door_operators_record_arrival_and_release_children_only_to_authorized_collectors()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x);
        await OpenAsync(x);
        var child = await RegisterAsync(x, await PersonAsync(x, new DateOnly(2018, 5, 1)), guardian: true);
        await ActAsync(x, child.Id, "confirm");

        f.Clock.Now = x.Event.StartsAt.AddMinutes(5);
        f.As(x.Cashier);
        await Assert.ThrowsAsync<DomainException>(() => PresenceAsync(x, child.Id, "arrive"));
        x.S.Use();
        Assert.Equal("arrive", (await PresenceAsync(x, child.Id, "arrive")).Action);
        var roster = await x.Service.PresentAsync(x.Parish, x.EventId, default);
        Assert.Equal(child.PersonId, Assert.Single(roster.Entries).PersonId);
        Assert.Contains("not a census", roster.Coverage);
        Assert.Equal("collector_not_authorized", (await Assert.ThrowsAsync<DomainException>(() => PresenceAsync(x, child.Id, "checkout"))).Code);
        await PresenceAsync(x, child.Id, "checkout", collector: "collector-1");
        Assert.Empty((await x.Service.PresentAsync(x.Parish, x.EventId, default)).Entries);
        await PresenceAsync(x, child.Id, "reenter");
        Assert.Single((await x.Service.PresentAsync(x.Parish, x.EventId, default)).Entries);
    }

    [Fact]
    public async Task Members_register_themselves_see_only_their_own_projection_and_cancel_before_arrival()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x);
        var member = await LinkedMemberAsync(x);
        f.As(member.AccountId, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => RegisterOwnAsync(x));
        await OpenAsync(x);

        f.As(member.AccountId, mfa: false);
        var own = await RegisterOwnAsync(x);
        Assert.Equal("Self", own.Origin);
        Assert.Equal("Submitted", own.Status);
        Assert.Null(own.CreatedBy);
        Assert.Null(own.Collectors);
        Assert.Equal("registration_state", (await Assert.ThrowsAsync<DomainException>(() => RegisterOwnAsync(x))).Code);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.ListAsync(x.Parish, x.EventId, 25, null, default));

        // Capacity and confirmation stay with the office, exactly as for office-entered registrations.
        Assert.Equal("Confirmed", (await ActAsync(x, own.Id, "confirm")).Status);
        x.S.Use();
        Assert.Equal(member.AccountId, (await x.Service.GetAsync(x.Parish, x.EventId, own.Id, default)).Value.CreatedBy);

        f.As(member.AccountId, mfa: false);
        var mine = await x.Service.OwnAsync(x.Parish, x.EventId, default);
        Assert.Equal("Confirmed", mine.Value.Status);
        var cancelled = await x.Service.CancelOwnAsync(x.Parish, x.EventId, new CancelOwnRegistrationDto
        {
            OperationId = Guid.NewGuid(), Version = mine.Version, Reason = "Schedule conflict"
        }, default);
        Assert.Equal("Cancelled", cancelled.Status);

        var stranger = await f.CreateVerifiedMemberAsync();
        f.As(stranger, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.OwnAsync(x.Parish, x.EventId, default));
    }

    [Fact]
    public async Task Registration_HTTP_requires_identity_and_CSRF_and_returns_the_member_projection()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x);
        await OpenAsync(x);
        var member = await LinkedMemberAsync(x);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        using var client = factory.Client();
        var path = $"/api/parishes/{x.Parish}/calendar/events/{x.EventId}/registrations";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path + "/mine")).StatusCode);

        await MinistryHttpTests.LoginAsync(client, member.Username);
        var request = new RegisterOwnDto { OperationId = Guid.NewGuid(), Answers = new() { ["diet"] = "Vegetarian" } };
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.False((await client.PostAsJsonAsync(path + "/mine", request)).IsSuccessStatusCode);
        await MinistryHttpTests.CsrfAsync(client);
        var created = await MinistryHttpTests.ReadAsync<EventRegistrationDto>(await client.PostAsJsonAsync(path + "/mine", request));
        Assert.Equal("Self", created.Origin);
        var json = await (await client.GetAsync(path + "/mine")).Content.ReadAsStringAsync();
        Assert.Contains("Vegetarian", json);
        Assert.DoesNotContain(member.AccountId, json);
        Assert.False((await client.GetAsync(path)).IsSuccessStatusCode);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f, bool confirm = true)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "finance"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows:
        [
            Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.SchedulePublish, Permissions.RegistrationsManage,
            Permissions.CheckIn, Permissions.PeopleRead, Permissions.PeopleWrite
        ]));
        var scheduling = new SchedulingScenario(staff, appointment.Id);
        var cashier = await f.CreateVerifiedStaffAsync();
        var approver = await f.CreateVerifiedStaffAsync();
        await GrantAsync(staff, cashier, [Permissions.FinanceEnter, Permissions.FinanceRead, Permissions.CheckIn]);
        await GrantAsync(staff, approver, [Permissions.FinanceApprove, Permissions.FinanceRead]);
        var occurrence = await scheduling.EventAsync(f.Clock.Now.AddDays(7));
        if (confirm)
            occurrence = await scheduling.EventActionAsync(occurrence.Id, "confirm");
        return new Setup(f, scheduling, cashier, approver, occurrence);
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

    private static ConfigureRegistrationDto Policy(Setup x, int capacity) => new()
    {
        OperationId = Guid.NewGuid(), Capacity = capacity, TransportCapacity = 0, Fee = 10m, Currency = "USD", Precision = 2,
        WaitlistAllowed = true, MinimumAge = 0, MaximumAge = 120, ChildAgeThreshold = 16, ConsentRequired = false, ConsentText = "",
        DoorAccountIds = [Guid.Parse(x.F.Other)],
        Fields = [new RegistrationField { Key = "diet", Label = "Dietary needs", Type = "Text", Required = false }]
    };

    private static async Task<RegistrationPolicy> ConfigureAsync(Setup x, int capacity = 5)
    {
        x.S.Use();
        return await x.Service.ConfigureAsync(x.Parish, x.EventId, Policy(x, capacity), default);
    }

    private static async Task<RegistrationPolicy> OpenAsync(Setup x)
    {
        x.S.Use();
        return await x.Service.PolicyActionAsync(x.Parish, x.EventId, new RegistrationPolicyActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Service.PolicyAsync(x.Parish, x.EventId, default)).Version, Action = "open"
        }, default);
    }

    private static async Task<string> PersonAsync(Setup x, DateOnly birth)
    {
        x.S.Use();
        return (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Participant", BirthDate = birth
        }, default)).Id;
    }

    private static async Task<(string AccountId, string PersonId, string Username)> LinkedMemberAsync(Setup x)
    {
        var account = await x.F.CreateVerifiedMemberAsync();
        var person = await PersonAsync(x, new DateOnly(1985, 3, 1));
        x.S.Use();
        await x.F.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), PersonId = Guid.Parse(person),
            EvidenceReference = "Isolated reviewed person-account identity"
        }, default);
        var user = await x.F.Services.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ParishLife.Api.Identity.ParishUser>>().FindByIdAsync(account);
        return (account, person, user!.UserName!);
    }

    private static async Task<EventRegistration> RegisterAsync(Setup x, string person, bool guardian = false)
    {
        x.S.Use();
        return await x.Service.RegisterAsync(x.Parish, x.EventId, new RegisterParticipantDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(person), Transport = false, Answers = new() { ["diet"] = "None" },
            GuardianAuthorityEvidence = guardian ? "Isolated verified guardian authority" : null, Collectors = guardian ? [Collector()] : []
        }, default);
    }

    private static Task<EventRegistrationDto> RegisterOwnAsync(Setup x)
        => x.Service.RegisterOwnAsync(x.Parish, x.EventId, new RegisterOwnDto { OperationId = Guid.NewGuid(), Answers = new() { ["diet"] = "None" } }, default);

    private static AuthorizedCollector Collector() => new() { Id = "collector-1", Name = "Isolated collector", AuthorityEvidence = "Isolated guardian designation" };

    private static async Task<EventRegistration> ActAsync(Setup x, string id, string action, DateTimeOffset? offerUntil = null)
    {
        x.S.Use();
        return await x.Service.ActAsync(x.Parish, x.EventId, id, new RegistrationActionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Action = action, Reason = "Isolated office decision", OfferUntil = offerUntil
        }, default);
    }

    private static async Task<RegistrationMovement> ReceiptAsync(Setup x, string id, decimal amount)
        => await x.Service.ReceiptAsync(x.Parish, x.EventId, id, new RecordEventReceiptDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Amount = amount, Currency = "USD",
            EvidenceReference = "Isolated paper receipt", OccurredAt = x.F.Clock.Now
        }, default);

    private static async Task<RegistrationRefund> RefundActionAsync(Setup x, string id, string refund, string action)
        => await x.Service.RefundActionAsync(x.Parish, x.EventId, id, refund, new DecideEventRefundDto
        {
            OperationId = Guid.NewGuid(), Version = (await Records(x).ReadAsync<RegistrationRefund>(Scope(x), "registrationRefund:" + refund, default))!.Version,
            Action = action, Reason = "Isolated finance decision", EvidenceReference = action == "record" ? "Isolated refund receipt" : null,
            OccurredAt = action == "record" ? x.F.Clock.Now : null
        }, default);

    private static async Task<PresenceChange> PresenceAsync(Setup x, string id, string action, string? collector = null)
        => await x.Service.PresenceAsync(x.Parish, x.EventId, id, new RecordPresenceDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Action = action, OccurredAt = x.F.Clock.Now,
            CollectorId = collector, VerificationEvidence = collector is null ? null : "Isolated photo ID check"
        }, default);

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync(Setup x, string id)
        => (await Records(x).ReadAsync<EventRegistration>(Scope(x), "registration:" + id, default))!.Version;

    private static ParishLife.Api.Interfaces.Repositories.Common.IRecordTransactions Records(Setup x)
        => x.F.Services.GetRequiredService<ParishLife.Api.Interfaces.Repositories.Common.IRecordTransactions>();

    private static RecordScope Scope(Setup x) => new() { Area = ParishLife.Api.Models.Enums.RecordArea.Parish, OwnerId = x.Parish };
}
