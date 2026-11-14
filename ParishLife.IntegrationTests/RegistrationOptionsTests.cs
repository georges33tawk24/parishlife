// Purpose: verifies the later event-registration options through real local services and storage: editing policy terms (deadline, capacity,
// currency lock), discounts with instalments and payment methods, household registration, pickup codes (hash only, never stored or replayed)
// and evacuation roll calls, plus HTTP identity checks for the new routes.
// Main tests: one per option; helpers build a parish with scheduling, registration, check-in, people and separate cashier finance grants.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Registrations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RegistrationOptionsTests
{
    private sealed record Setup(LocalBackendFixture F, SchedulingScenario S, string Cashier, CalendarEventDto Event)
    {
        public RegistrationService Service => F.Services.GetRequiredService<RegistrationService>();
        public RegistrationTermsService Terms => F.Services.GetRequiredService<RegistrationTermsService>();
        public EvacuationService Evacuations => F.Services.GetRequiredService<EvacuationService>();
        public string Parish => S.Parish;
        public string EventId => Event.Id;
    }

    [Fact]
    public async Task Terms_edits_keep_current_seats_lock_currency_and_the_deadline_stops_new_submissions()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x, capacity: 2);
        await OpenAsync(x);
        var first = await RegisterAsync(x, await PersonAsync(x, new DateOnly(1990, 1, 1)));
        var second = await RegisterAsync(x, await PersonAsync(x, new DateOnly(1991, 1, 1)));
        await ActAsync(x, first.Id, "confirm");
        await ActAsync(x, second.Id, "confirm");

        f.As(x.Cashier);
        await Assert.ThrowsAsync<DomainException>(() => ReviseAsync(x, t => { }));
        x.S.Use();
        Assert.Equal("capacity_below_current", (await Assert.ThrowsAsync<DomainException>(() => ReviseAsync(x, t => t.Capacity = 1))).Code);
        Assert.Equal("registration_currency_locked", (await Assert.ThrowsAsync<DomainException>(() => ReviseAsync(x, t => t.Currency = "EUR"))).Code);
        Assert.Equal("invalid_registration_deadline", (await Assert.ThrowsAsync<DomainException>(() => ReviseAsync(x, t => t.ClosesAt = x.Event.StartsAt))).Code);

        var revised = await ReviseAsync(x, t =>
        {
            t.Capacity = 3;
            t.ClosesAt = f.Clock.Now.AddDays(1);
            t.MusterPoint = "Isolated muster point";
            t.MusterPointAr = "نقطة تجمّع";
        });
        Assert.Equal(3, revised.Capacity);
        Assert.Equal(x.F.Other, revised.UpdatedBy);

        // An unrelated policy transition keeps the edited terms.
        x.S.Use();
        await x.Service.ReviseFormAsync(x.Parish, x.EventId, new ReviseFormDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Service.PolicyAsync(x.Parish, x.EventId, default)).Version,
            Fields = [new RegistrationField { Key = "diet", Label = "Dietary needs", Type = "Text" }]
        }, default);
        var policy = (await x.Service.PolicyAsync(x.Parish, x.EventId, default)).Value;
        Assert.Equal(revised.ClosesAt, policy.ClosesAt);
        Assert.Equal("نقطة تجمّع", policy.MusterPointAr);

        var late = await PersonAsync(x, new DateOnly(1992, 1, 1));
        f.Clock.Now = f.Clock.Now.AddDays(2);
        Assert.Equal("registration_deadline_passed", (await Assert.ThrowsAsync<DomainException>(() => RegisterAsync(x, late))).Code);
    }

    [Fact]
    public async Task Discounts_instalments_and_payment_methods_shape_the_balance_without_moving_money()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var today = DateOnly.FromDateTime(f.Clock.Now.UtcDateTime);
        x.S.Use();
        var configure = Policy(x, 5);
        configure.Discounts = [new RegistrationDiscount { Key = "sibling", Name = "Isolated sibling discount", NameAr = "حسم", Amount = 3m }];
        configure.Instalments = [new RegistrationInstalment { DueOn = today.AddDays(-1), Amount = 4m }, new RegistrationInstalment { DueOn = today.AddDays(3), Amount = 6m }];
        configure.PaymentMethods = ["Cash", "BankTransfer"];
        await x.Service.ConfigureAsync(x.Parish, x.EventId, configure, default);
        var bad = Policy(x, 5);
        bad.Instalments = [new RegistrationInstalment { DueOn = today, Amount = 4m }];
        Assert.Equal("invalid_instalments", (await Assert.ThrowsAsync<DomainException>(() => x.Service.ConfigureAsync(x.Parish, x.EventId, bad, default))).Code);
        await OpenAsync(x);
        var row = await RegisterAsync(x, await PersonAsync(x, new DateOnly(1990, 1, 1)));

        Assert.Equal("discount_unavailable", (await Assert.ThrowsAsync<DomainException>(() => DiscountAsync(x, row.Id, "unknown"))).Code);
        var discounted = await DiscountAsync(x, row.Id, "sibling");
        Assert.Equal(3m, discounted.DiscountAmount);
        Assert.Equal("حسم", discounted.DiscountNameAr);

        f.As(x.Cashier);
        var cashier = (await x.Service.CashierRegistrationAsync(x.Parish, x.EventId, row.Id, default)).Value;
        Assert.Equal(7m, cashier.Due);
        Assert.Equal(4m, cashier.DueNow);
        Assert.Equal(7m, cashier.Outstanding);
        Assert.Equal(["Cash", "BankTransfer"], cashier.PaymentMethods);
        Assert.Equal("payment_method_not_accepted", (await Assert.ThrowsAsync<DomainException>(() => ReceiptAsync(x, row.Id, 4m, "Cheque"))).Code);
        var receipt = await ReceiptAsync(x, row.Id, 4m, "BankTransfer");
        Assert.Equal(("PaymentReceived", "BankTransfer"), (receipt.Kind, receipt.Method));
        Assert.Equal("invalid_event_receipt", (await Assert.ThrowsAsync<DomainException>(() => ReceiptAsync(x, row.Id, 4m, "Cash"))).Code);

        await DiscountAsync(x, row.Id, null);
        f.As(x.Cashier);
        Assert.Equal("CashReceived", (await ReceiptAsync(x, row.Id, 6m, "Cash")).Kind);
        // A discount never pushes the amount owed below what was already received.
        Assert.Equal("discount_below_received", (await Assert.ThrowsAsync<DomainException>(() => DiscountAsync(x, row.Id, "sibling"))).Code);
        f.As(x.Cashier);
        Assert.Equal(0m, (await x.Service.CashierRegistrationAsync(x.Parish, x.EventId, row.Id, default)).Value.Outstanding);
    }

    [Fact]
    public async Task Household_registration_creates_every_member_together_and_refuses_people_outside_the_household()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x);
        await OpenAsync(x);
        var parent = await PersonAsync(x, new DateOnly(1980, 1, 1));
        var child = await PersonAsync(x, new DateOnly(2018, 5, 1));
        var outsider = await PersonAsync(x, new DateOnly(1985, 1, 1));
        var household = await HouseholdAsync(x, parent, child);
        x.S.Use();
        var form = Guid.Parse((await x.Service.PolicyAsync(x.Parish, x.EventId, default)).Value.FormVersionId);

        x.S.Use();
        var withOutsider = Household(household, form, parent, outsider);
        Assert.Equal("not_household_member", (await Assert.ThrowsAsync<DomainException>(() => x.Terms.RegisterHouseholdAsync(x.Parish, x.EventId, withOutsider, default))).Code);
        Assert.Empty((await x.Service.ListAsync(x.Parish, x.EventId, 25, null, default)).Items);

        var request = Household(household, form, parent, child);
        var created = await x.Terms.RegisterHouseholdAsync(x.Parish, x.EventId, request, default);
        Assert.Equal(2, created.Count);
        Assert.All(created, r => Assert.Equal((household, "Submitted", "Office"), (r.HouseholdId!, r.Status, r.Origin)));
        Assert.Equal(created.Select(r => r.Id), (await x.Terms.RegisterHouseholdAsync(x.Parish, x.EventId, request, default)).Select(r => r.Id));
        request.OperationId = Guid.NewGuid();
        Assert.Equal("registration_state", (await Assert.ThrowsAsync<DomainException>(() => x.Terms.RegisterHouseholdAsync(x.Parish, x.EventId, request, default))).Code);

        f.As(x.Cashier);
        request.OperationId = Guid.NewGuid();
        await Assert.ThrowsAsync<DomainException>(() => x.Terms.RegisterHouseholdAsync(x.Parish, x.EventId, request, default));
    }

    [Fact]
    public async Task Pickup_codes_are_shown_once_stored_only_as_a_hash_and_required_at_checkout()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x);
        await OpenAsync(x);
        var child = await RegisterAsync(x, await PersonAsync(x, new DateOnly(2018, 5, 1)), guardian: true);
        await ActAsync(x, child.Id, "confirm");

        f.As(x.Cashier);
        await Assert.ThrowsAsync<DomainException>(() => PickupAsync(x, child.Id, "issue"));
        var request = new PickupCodeActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync(x, child.Id), Action = "issue", Reason = "Guardian asked for a code" };
        x.S.Use();
        var issued = await x.Terms.PickupCodeAsync(x.Parish, x.EventId, child.Id, request, default);
        var code = Assert.IsType<string>(issued.Code);
        Assert.Equal(8, code.Length);
        Assert.Null((await x.Terms.PickupCodeAsync(x.Parish, x.EventId, child.Id, request, default)).Code);
        Assert.True((await x.Service.GetAsync(x.Parish, x.EventId, child.Id, default)).Value.PickupCodeHash is not null);
        Assert.True((await x.Service.StaffViewAsync((await x.Service.GetAsync(x.Parish, x.EventId, child.Id, default)).Value, default)).PickupCodeIssued);

        // Amending the registration keeps the issued code.
        await x.Service.AmendAsync(x.Parish, x.EventId, child.Id, new AmendParticipantDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, child.Id), Answers = new() { ["diet"] = "None" },
            GuardianAuthorityEvidence = "Isolated verified guardian authority", Collectors = [Collector()], Reason = "Isolated amendment"
        }, default);
        Assert.True((await x.Service.DoorRegistrationAsync(x.Parish, x.EventId, child.Id, default)).Value.PickupCodeRequired);

        f.Clock.Now = x.Event.StartsAt.AddMinutes(5);
        await PresenceAsync(x, child.Id, "arrive");
        Assert.Equal("pickup_code_mismatch", (await Assert.ThrowsAsync<DomainException>(() => PresenceAsync(x, child.Id, "checkout", "collector-1"))).Code);
        Assert.Equal("pickup_code_mismatch", (await Assert.ThrowsAsync<DomainException>(() => PresenceAsync(x, child.Id, "checkout", "collector-1", "WRONG123"))).Code);
        var checkout = await PresenceAsync(x, child.Id, "checkout", "collector-1", code.ToLowerInvariant()[..4] + "-" + code[4..]);
        Assert.True(checkout.PickupCodeChecked);

        await PresenceAsync(x, child.Id, "reenter");
        await PickupAsync(x, child.Id, "revoke");
        Assert.False((await PresenceAsync(x, child.Id, "checkout", "collector-1")).PickupCodeChecked);

        // The plain code appears nowhere in storage: not in the registration, the operation receipts, the presence records or the audit.
        foreach (var file in Directory.EnumerateFiles(f.DirectoryPath, "*", SearchOption.AllDirectories))
        {
            using var stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var reader = new StreamReader(stream);
            Assert.DoesNotContain(code, await reader.ReadToEndAsync(), StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Evacuation_roll_calls_belong_to_assigned_door_operators_and_list_only_present_participants()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x);
        await OpenAsync(x);
        var here = await RegisterAsync(x, await PersonAsync(x, new DateOnly(1990, 1, 1)));
        var away = await RegisterAsync(x, await PersonAsync(x, new DateOnly(1991, 1, 1)));
        await ActAsync(x, here.Id, "confirm");
        await ActAsync(x, away.Id, "confirm");
        f.Clock.Now = x.Event.StartsAt.AddMinutes(5);
        x.S.Use();
        await PresenceAsync(x, here.Id, "arrive");

        f.As(x.Cashier);
        Assert.Equal("event_assignment_required", (await Assert.ThrowsAsync<DomainException>(() => StartAsync(x))).Code);
        x.S.Use();
        var started = await StartAsync(x);
        Assert.Equal((1, 0, "Open"), (started.Value.Total, started.Value.Accounted, started.Value.Status));
        Assert.Equal(here.Id, Assert.Single(started.Value.Entries).RegistrationId);
        Assert.Contains("not a census", started.Value.Coverage);
        Assert.Equal("registration_state", (await Assert.ThrowsAsync<DomainException>(() => StartAsync(x))).Code);

        Assert.Equal("registration_resource_unavailable", (await Assert.ThrowsAsync<DomainException>(() => EvacuationActAsync(x, started, "account", away.Id))).Code);
        var accounted = await EvacuationActAsync(x, started, "account", here.Id);
        Assert.Equal(1, accounted.Value.Accounted);
        var closed = await EvacuationActAsync(x, accounted, "close", null);
        Assert.Equal("Closed", closed.Value.Status);
        await StartAsync(x);
        Assert.Equal(2, (await x.Evacuations.ListAsync(x.Parish, x.EventId, default)).Count);
    }

    [Fact]
    public async Task Registration_option_routes_require_identity_and_permission()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await ConfigureAsync(x);
        var member = await f.CreateVerifiedMemberAsync();
        var username = (await f.Services.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ParishLife.Api.Identity.ParishUser>>().FindByIdAsync(member))!.UserName!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        using var client = factory.Client();
        var path = $"/api/parishes/{x.Parish}/calendar/events/{x.EventId}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path + "/evacuations")).StatusCode);

        await MinistryHttpTests.LoginAsync(client, username);
        await MinistryHttpTests.CsrfAsync(client);
        Assert.False((await client.GetAsync(path + "/evacuations")).IsSuccessStatusCode);
        var terms = Terms(x, "0");
        Assert.False((await client.PostAsJsonAsync(path + "/registration/terms", terms)).IsSuccessStatusCode);
        Assert.False((await client.PostAsJsonAsync(path + "/registrations/household", new RegisterHouseholdDto
        {
            OperationId = Guid.NewGuid(), HouseholdId = Guid.NewGuid(), FormVersionId = Guid.NewGuid(), Members = [new HouseholdParticipantDto { PersonId = Guid.NewGuid() }]
        })).IsSuccessStatusCode);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
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
        staff.Fixture.As(staff.Fixture.FirstAdmin);
        await staff.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(cashier), Allows = [Permissions.FinanceEnter, Permissions.FinanceRead, Permissions.CheckIn], StartsAt = staff.Fixture.Clock.Now
        }, default);
        var occurrence = await scheduling.EventActionAsync((await scheduling.EventAsync(f.Clock.Now.AddDays(7))).Id, "confirm");
        return new Setup(f, scheduling, cashier, occurrence);
    }

    private static ConfigureRegistrationDto Policy(Setup x, int capacity) => new()
    {
        OperationId = Guid.NewGuid(), Capacity = capacity, TransportCapacity = 0, Fee = 10m, Currency = "USD", Precision = 2,
        WaitlistAllowed = true, MinimumAge = 0, MaximumAge = 120, ChildAgeThreshold = 16, ConsentRequired = false, ConsentText = "",
        DoorAccountIds = [Guid.Parse(x.F.Other)],
        Fields = [new RegistrationField { Key = "diet", Label = "Dietary needs", Type = "Text", Required = false }]
    };

    private static ReviseRegistrationTermsDto Terms(Setup x, string version) => new()
    {
        OperationId = Guid.NewGuid(), Version = version, Capacity = 5, TransportCapacity = 0, Fee = 10m, Currency = "USD", Precision = 2,
        WaitlistAllowed = true, MinimumAge = 0, MaximumAge = 120, ChildAgeThreshold = 16, ConsentRequired = false, ConsentText = "",
        DoorAccountIds = [Guid.Parse(x.F.Other)], Reason = "Isolated terms review"
    };

    private static async Task<RegistrationPolicy> ReviseAsync(Setup x, Action<ReviseRegistrationTermsDto> change)
    {
        var request = Terms(x, (await Records(x).ReadAsync<RegistrationPolicy>(Scope(x), "registrationPolicy:" + x.EventId, default))!.Version);
        change(request);
        return await x.Terms.ReviseTermsAsync(x.Parish, x.EventId, request, default);
    }

    private static async Task ConfigureAsync(Setup x, int capacity = 5)
    {
        x.S.Use();
        await x.Service.ConfigureAsync(x.Parish, x.EventId, Policy(x, capacity), default);
    }

    private static async Task OpenAsync(Setup x)
    {
        x.S.Use();
        await x.Service.PolicyActionAsync(x.Parish, x.EventId, new RegistrationPolicyActionDto
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

    private static async Task<string> HouseholdAsync(Setup x, params string[] people)
    {
        x.S.Use();
        var service = x.F.Services.GetRequiredService<HouseholdService>();
        var household = await service.SaveAsync(x.Parish, null, new SaveHouseholdDto { OperationId = Guid.NewGuid(), Name = "Isolated household" }, default);
        foreach (var person in people)
            await service.MemberAsync(x.Parish, household.Id, new HouseholdMemberActionDto
            {
                OperationId = Guid.NewGuid(), Version = (await Records(x).ReadAsync<Household>(Scope(x), "household:" + household.Id, default))!.Version,
                PersonId = Guid.Parse(person), Action = "add"
            }, default);
        return household.Id;
    }

    private static RegisterHouseholdDto Household(string household, Guid form, params string[] people) => new()
    {
        OperationId = Guid.NewGuid(), HouseholdId = Guid.Parse(household), FormVersionId = form,
        Members = people.Select(p => new HouseholdParticipantDto
        {
            PersonId = Guid.Parse(p), Answers = new() { ["diet"] = "None" }, GuardianAuthorityEvidence = "Isolated verified guardian authority", Collectors = [Collector()]
        }).ToArray()
    };

    private static async Task<EventRegistration> RegisterAsync(Setup x, string person, bool guardian = false)
    {
        x.S.Use();
        var policy = await x.Service.PolicyAsync(x.Parish, x.EventId, default);
        return await x.Service.RegisterAsync(x.Parish, x.EventId, new RegisterParticipantDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(person), FormVersionId = Guid.Parse(policy.Value.FormVersionId), Answers = new() { ["diet"] = "None" },
            GuardianAuthorityEvidence = guardian ? "Isolated verified guardian authority" : null, Collectors = guardian ? [Collector()] : []
        }, default);
    }

    private static AuthorizedCollector Collector() => new() { Id = "collector-1", Name = "Isolated collector", AuthorityEvidence = "Isolated guardian designation" };

    private static async Task<EventRegistration> ActAsync(Setup x, string id, string action)
    {
        x.S.Use();
        return await x.Service.ActAsync(x.Parish, x.EventId, id, new RegistrationActionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Action = action, Reason = "Isolated office decision"
        }, default);
    }

    private static async Task<EventRegistration> DiscountAsync(Setup x, string id, string? key)
    {
        x.S.Use();
        return await x.Terms.ApplyDiscountAsync(x.Parish, x.EventId, id, new ApplyRegistrationDiscountDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), DiscountKey = key, Reason = "Isolated discount decision"
        }, default);
    }

    private static async Task<RegistrationMovement> ReceiptAsync(Setup x, string id, decimal amount, string method)
        => await x.Service.ReceiptAsync(x.Parish, x.EventId, id, new RecordEventReceiptDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Amount = amount, Currency = "USD",
            EvidenceReference = "Isolated paper receipt", OccurredAt = x.F.Clock.Now, Method = method
        }, default);

    private static async Task<PickupCodeResultDto> PickupAsync(Setup x, string id, string action)
        => await x.Terms.PickupCodeAsync(x.Parish, x.EventId, id, new PickupCodeActionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Action = action, Reason = "Isolated pickup-code decision"
        }, default);

    private static async Task<PresenceChange> PresenceAsync(Setup x, string id, string action, string? collector = null, string? code = null)
        => await x.Service.PresenceAsync(x.Parish, x.EventId, id, new RecordPresenceDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Action = action, OccurredAt = x.F.Clock.Now,
            CollectorId = collector, VerificationEvidence = collector is null ? null : "Isolated photo ID check", PickupCode = code
        }, default);

    private static async Task<Versioned<EvacuationDto>> StartAsync(Setup x)
        => await x.Evacuations.StartAsync(x.Parish, x.EventId, new StartEvacuationDto { OperationId = Guid.NewGuid(), Kind = "Drill" }, default);

    private static async Task<Versioned<EvacuationDto>> EvacuationActAsync(Setup x, Versioned<EvacuationDto> current, string action, string? registration)
    {
        var version = (await Records(x).ReadAsync<EvacuationRollCall>(Scope(x), "evacuation:" + current.Value.Id, default))!.Version;
        return await x.Evacuations.ActAsync(x.Parish, x.EventId, current.Value.Id, new EvacuationActionDto
        {
            OperationId = Guid.NewGuid(), Version = version, Action = action, RegistrationId = registration is null ? null : Guid.Parse(registration)
        }, default);
    }

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync(Setup x, string id)
        => (await Records(x).ReadAsync<EventRegistration>(Scope(x), "registration:" + id, default))!.Version;

    private static IRecordTransactions Records(Setup x) => x.F.Services.GetRequiredService<IRecordTransactions>();

    private static RecordScope Scope(Setup x) => new() { Area = ParishLife.Api.Models.Enums.RecordArea.Parish, OwnerId = x.Parish };
}
