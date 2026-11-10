// Purpose: verifies households and person relationships (S09) through real local services and storage.
// Main tests: one primary household, inherited versus own addresses, contact changes and history; unique envelope identifiers;
// mirrored relationships, circular-parentage and guardian-evidence rules; read/write permission boundaries.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class HouseholdTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment)
    {
        public HouseholdService Service => F.Services.GetRequiredService<HouseholdService>();
        public string Parish => Staff.Parish;
        public void Use() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task One_primary_household_shared_address_overrides_and_contact_history()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var a = await PersonAsync(x, "Alpha");
        var b = await PersonAsync(x, "Beta");
        x.Use();
        var home = await x.Service.SaveAsync(x.Parish, null, Household("Alpha family", "1 Cedar Street"), default);
        var other = await x.Service.SaveAsync(x.Parish, null, Household("Other family", "9 Pine Road"), default);
        await MemberAsync(x, home.Id, a, "add", inherits: true);
        var withB = await MemberAsync(x, home.Id, b, "add", inherits: false, own: "Student residence");
        Assert.Equal("Student residence", withB.Members.Single(m => m.PersonId == b).EffectiveAddress);
        Assert.Equal("invalid_household_state", (await Assert.ThrowsAsync<DomainException>(() => MemberAsync(x, other.Id, a, "add", inherits: true))).Code);
        var contact = await MemberAsync(x, home.Id, a, "set-contact");
        Assert.True(contact.Members.Single(m => m.PersonId == a).IsContact);

        var moved = Household("Alpha family", "22 Olive Avenue");
        moved.Version = (await x.Service.GetAsync(x.Parish, home.Id, default)).Version;
        var after = await x.Service.SaveAsync(x.Parish, home.Id, moved, default);
        Assert.Equal("22 Olive Avenue", after.Members.Single(m => m.PersonId == a).EffectiveAddress);
        Assert.Equal("Student residence", after.Members.Single(m => m.PersonId == b).EffectiveAddress);

        var removed = await MemberAsync(x, home.Id, a, "remove");
        Assert.Null(removed.ContactPersonId);
        Assert.Single(removed.Members, m => m.PersonId == b);
        Assert.Equal("Other family", (await MemberAsync(x, other.Id, a, "add", inherits: true)).Name);
        var history = (await x.Service.HistoryAsync(x.Parish, home.Id, 50, null, default)).Items;
        Assert.Equal("1 Cedar Street", Assert.Single(history, h => h.Action == "address").Previous);
        Assert.Contains(history, h => h.Action == "set-contact" && h.PersonId == a);
    }

    [Fact]
    public async Task Envelope_identifiers_are_unique_and_released_when_changed()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var first = await x.Service.SaveAsync(x.Parish, null, Household("First", null, "E-100"), default);
        Assert.Equal("invalid_household_state", (await Assert.ThrowsAsync<DomainException>(() =>
            x.Service.SaveAsync(x.Parish, null, Household("Second", null, "e-100"), default))).Code);
        var second = await x.Service.SaveAsync(x.Parish, null, Household("Second", null, "E-200"), default);
        var change = Household("First", null, "E-101");
        change.Version = (await x.Service.GetAsync(x.Parish, first.Id, default)).Version;
        await x.Service.SaveAsync(x.Parish, first.Id, change, default);
        var take = Household("Second", null, "E-100");
        take.Version = (await x.Service.GetAsync(x.Parish, second.Id, default)).Version;
        Assert.Equal("E-100", (await x.Service.SaveAsync(x.Parish, second.Id, take, default)).EnvelopeId);
    }

    [Fact]
    public async Task Relationships_are_mirrored_acyclic_evidenced_for_guardians_and_end_together()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var grandparent = await PersonAsync(x, "Grandparent");
        var parent = await PersonAsync(x, "Parent");
        var child = await PersonAsync(x, "Child");
        var other = await PersonAsync(x, "Other");
        var third = await PersonAsync(x, "Third");
        x.Use();
        var link = await RelateAsync(x, parent, grandparent, "Parent");
        await RelateAsync(x, child, parent, "Parent");
        var mirror = Assert.Single((await x.Service.RelationshipsAsync(x.Parish, grandparent, 25, null, default)).Items).Value;
        Assert.Equal(("Child", parent, "Parent"), (mirror.Kind, mirror.RelatedPersonId, mirror.RelatedName.Split(' ')[0]));

        Assert.Equal("invalid_household_state", (await Assert.ThrowsAsync<DomainException>(() => RelateAsync(x, grandparent, child, "Parent"))).Code);
        Assert.Equal("invalid_household_state", (await Assert.ThrowsAsync<DomainException>(() => RelateAsync(x, parent, grandparent, "Parent"))).Code);
        await RelateAsync(x, child, other, "Parent");
        await Assert.ThrowsAsync<DomainException>(() => RelateAsync(x, child, third, "Parent"));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => RelateAsync(x, child, third, "Guardian"))).Code);
        Assert.Equal("Guardian", (await RelateAsync(x, child, third, "Guardian", "Isolated court order reference")).Kind);

        var row = (await x.Service.RelationshipsAsync(x.Parish, parent, 25, null, default)).Items.Single(r => r.Value.Id == link.Id);
        var ended = await x.Service.EndRelationshipAsync(x.Parish, parent, link.Id, new EndRelationshipDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, Reason = "Recorded against the wrong person"
        }, default);
        Assert.Equal("Ended", ended.Status);
        Assert.Equal("Ended", Assert.Single((await x.Service.RelationshipsAsync(x.Parish, grandparent, 25, null, default)).Items).Value.Status);
    }

    [Fact]
    public async Task Household_reads_and_changes_need_people_permissions()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var home = await x.Service.SaveAsync(x.Parish, null, Household("Private", "Hidden lane"), default);
        var reader = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(x.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Staff.Parishes.GetAsync(x.Parish, default))!.Version,
            AccountId = Guid.Parse(reader), Allows = [Permissions.PeopleRead], StartsAt = f.Clock.Now
        }, default);
        f.As(reader);
        Assert.Equal("Private", (await x.Service.GetAsync(x.Parish, home.Id, default)).Value.Name);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveAsync(x.Parish, null, Household("Not allowed", null), default));
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GetAsync(x.Parish, home.Id, default));
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        return new Setup(f, staff, appointment.Id);
    }

    private static async Task<string> PersonAsync(Setup x, string name)
    {
        x.Use();
        return (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = name, FamilyName = "Isolated", BirthDate = new DateOnly(1980, 1, 1)
        }, default)).Id;
    }

    private static SaveHouseholdDto Household(string name, string? address, string? envelope = null)
        => new() { OperationId = Guid.NewGuid(), Name = name, Address = address, EnvelopeId = envelope };

    private static async Task<HouseholdDto> MemberAsync(Setup x, string household, string person, string action, bool inherits = false, string? own = null)
        => await x.Service.MemberAsync(x.Parish, household, new HouseholdMemberActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Service.GetAsync(x.Parish, household, default)).Version, PersonId = Guid.Parse(person),
            Action = action, InheritsAddress = inherits, OwnAddress = own
        }, default);

    private static Task<RelationshipDto> RelateAsync(Setup x, string person, string related, string kind, string? evidence = null)
        => x.Service.AddRelationshipAsync(x.Parish, person, new AddRelationshipDto
        {
            OperationId = Guid.NewGuid(), RelatedPersonId = Guid.Parse(related), Kind = kind, Source = "Isolated office record", EvidenceReference = evidence
        }, default);
}
