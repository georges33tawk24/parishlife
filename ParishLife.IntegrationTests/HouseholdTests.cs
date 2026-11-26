// Purpose: verifies households and person relationships (S09) through real local services and storage.
// Main tests: one primary household, inherited versus own addresses, contact changes and history; unique envelope identifiers;
// mirrored relationships, circular-parentage and guardian-evidence rules; read/write permission boundaries; digit-free names; a new
// household's first members with a required contact; member roles on the membership (one head); the paged member search.

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

    [Fact]
    public async Task Household_names_refuse_digits_on_create_and_when_changed()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() =>
            x.Service.SaveAsync(x.Parish, null, Household("Family 2", null), default))).Code);
        var arabic = Household("Haddad", null);
        arabic.NameAr = "عائلة ٣";
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveAsync(x.Parish, null, arabic, default))).Code);
        var home = await x.Service.SaveAsync(x.Parish, null, Household("Haddad", "1 Cedar Street"), default);
        var rename = Household("Haddad 7", "1 Cedar Street");
        rename.Version = (await x.Service.GetAsync(x.Parish, home.Id, default)).Version;
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveAsync(x.Parish, home.Id, rename, default))).Code);
        rename.Name = "Haddad-Khoury";
        rename.OperationId = Guid.NewGuid();
        Assert.Equal("Haddad-Khoury", (await x.Service.SaveAsync(x.Parish, home.Id, rename, default)).Name);
    }

    [Fact]
    public async Task A_new_household_brings_its_members_only_with_a_contact_among_them_in_one_operation()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var a = await PersonAsync(x, "Alpha");
        var b = await PersonAsync(x, "Beta");
        var outsider = await PersonAsync(x, "Gamma");
        x.Use();
        var noContact = Household("Alpha family", "1 Cedar Street");
        noContact.Members = [new() { PersonId = Guid.Parse(a) }, new() { PersonId = Guid.Parse(b) }];
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveAsync(x.Parish, null, noContact, default))).Code);
        noContact.ContactPersonId = Guid.Parse(outsider);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveAsync(x.Parish, null, noContact, default))).Code);
        Assert.Empty((await x.Service.ListAsync(x.Parish, 25, null, default)).Items);

        var request = Household("Alpha family", "1 Cedar Street");
        request.Members = [new() { PersonId = Guid.Parse(a), Role = "Head" }, new() { PersonId = Guid.Parse(b), Role = "Spouse" }];
        request.ContactPersonId = Guid.Parse(a);
        var home = await x.Service.SaveAsync(x.Parish, null, request, default);
        Assert.Equal(a, home.ContactPersonId);
        Assert.Equal(("Head", "Spouse"), (home.Members.Single(m => m.PersonId == a).Role, home.Members.Single(m => m.PersonId == b).Role));
        Assert.Equal("1 Cedar Street", home.Members.Single(m => m.PersonId == b).EffectiveAddress);
        // The same operation replays; the members are not added twice.
        Assert.Equal(home.Id, (await x.Service.SaveAsync(x.Parish, null, request, default)).Id);
        Assert.Equal(2, (await x.Service.GetAsync(x.Parish, home.Id, default)).Value.Members.Length);
        var history = (await x.Service.HistoryAsync(x.Parish, home.Id, 50, null, default)).Items;
        Assert.Equal(2, history.Count(h => h.Action == "add"));

        var taken = Household("Second family", null);
        taken.Members = [new() { PersonId = Guid.Parse(b) }];
        taken.ContactPersonId = Guid.Parse(b);
        Assert.Equal("invalid_household_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveAsync(x.Parish, null, taken, default))).Code);
        var edit = Household("Alpha family", "1 Cedar Street");
        edit.Version = (await x.Service.GetAsync(x.Parish, home.Id, default)).Version;
        edit.Members = [new() { PersonId = Guid.Parse(outsider) }];
        edit.ContactPersonId = Guid.Parse(outsider);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveAsync(x.Parish, home.Id, edit, default))).Code);
    }

    [Fact]
    public async Task Member_roles_live_on_the_membership_with_one_head_and_history()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var a = await PersonAsync(x, "Alpha");
        var b = await PersonAsync(x, "Beta");
        var c = await PersonAsync(x, "Child");
        x.Use();
        var home = await x.Service.SaveAsync(x.Parish, null, Household("Alpha family", null), default);
        await MemberAsync(x, home.Id, a, "add", inherits: true, role: "Head");
        await MemberAsync(x, home.Id, b, "add", inherits: true);
        var withChild = await MemberAsync(x, home.Id, c, "add", inherits: true, role: "Child");
        Assert.Null(withChild.Members.Single(m => m.PersonId == b).Role);
        Assert.Equal("Child", withChild.Members.Single(m => m.PersonId == c).Role);

        Assert.Equal("Spouse", (await MemberAsync(x, home.Id, b, "set-role", role: "Spouse")).Members.Single(m => m.PersonId == b).Role);
        Assert.Equal("invalid_household_state", (await Assert.ThrowsAsync<DomainException>(() => MemberAsync(x, home.Id, b, "set-role", role: "Head"))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => MemberAsync(x, home.Id, c, "set-role", role: "Guardian"))).Code);
        Assert.Equal("OtherRelative", (await MemberAsync(x, home.Id, a, "set-role", role: "OtherRelative")).Members.Single(m => m.PersonId == a).Role);
        Assert.Equal("Head", (await MemberAsync(x, home.Id, b, "set-role", role: "Head")).Members.Single(m => m.PersonId == b).Role);
        Assert.Null((await MemberAsync(x, home.Id, c, "set-role", role: null)).Members.Single(m => m.PersonId == c).Role);
        var history = (await x.Service.HistoryAsync(x.Parish, home.Id, 50, null, default)).Items;
        Assert.Contains(history, h => h.Action == "role" && h.PersonId == b && h.Previous == "Spouse");
        Assert.Contains(history, h => h.Action == "role" && h.PersonId == c && h.Previous == "Child");

        // The role belongs to the membership: it leaves with the person and the Person record never carries it.
        await MemberAsync(x, home.Id, b, "remove");
        var other = await x.Service.SaveAsync(x.Parish, null, Household("Beta family", null), default);
        Assert.Null((await MemberAsync(x, other.Id, b, "add", inherits: true)).Members.Single().Role);
        var person = await f.Services.GetRequiredService<PeopleService>().GetAsync(x.Parish, b, default);
        Assert.DoesNotContain("\"role\"", System.Text.Json.JsonSerializer.Serialize(person.Value).ToLowerInvariant(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Member_search_needs_two_characters_pages_on_the_server_and_names_the_current_household()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var ids = new List<string>();
        foreach (var name in new[] { "Rana", "Rami", "Randa", "Ramez", "Rabih" })
            ids.Add(await PersonAsync(x, name));
        var unrelated = await PersonAsync(x, "Joseph");
        x.Use();
        var home = await x.Service.SaveAsync(x.Parish, null, Household("Rana family", null), default);
        await MemberAsync(x, home.Id, ids[0], "add", inherits: true);

        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.CandidatesAsync(x.Parish, "r", 20, null, default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.CandidatesAsync(x.Parish, "  ", 20, null, default))).Code);
        var first = await x.Service.CandidatesAsync(x.Parish, "ra", 2, null, default);
        Assert.Equal(2, first.Items.Count);
        Assert.NotNull(first.ContinuationToken);
        var seen = first.Items.Select(i => i.Id).ToList();
        var cursor = first.ContinuationToken;
        while (cursor is not null)
        {
            var next = await x.Service.CandidatesAsync(x.Parish, "ra", 2, cursor, default);
            seen.AddRange(next.Items.Select(i => i.Id));
            cursor = next.ContinuationToken;
        }
        Assert.Equal(ids.OrderBy(i => i), seen.OrderBy(i => i));
        Assert.DoesNotContain(unrelated, seen);
        var member = Assert.Single((await x.Service.CandidatesAsync(x.Parish, "RANA isolated", 20, null, default)).Items);
        Assert.Equal((home.Id, "Rana family"), (member.HouseholdId, member.HouseholdName));
        Assert.Null((await x.Service.CandidatesAsync(x.Parish, "rami", 20, null, default)).Items.Single().HouseholdId);
        Assert.Equal("invalid_cursor", (await Assert.ThrowsAsync<DomainException>(() => x.Service.CandidatesAsync(x.Parish, "ra", 2, "not-a-cursor", default))).Code);

        var outsider = await f.CreateVerifiedMemberAsync();
        f.As(outsider);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.CandidatesAsync(x.Parish, "ra", 20, null, default));
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

    private static async Task<HouseholdDto> MemberAsync(Setup x, string household, string person, string action, bool inherits = false, string? own = null, string? role = null)
        => await x.Service.MemberAsync(x.Parish, household, new HouseholdMemberActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Service.GetAsync(x.Parish, household, default)).Version, PersonId = Guid.Parse(person),
            Action = action, InheritsAddress = inherits, OwnAddress = own, Role = role
        }, default);

    private static Task<RelationshipDto> RelateAsync(Setup x, string person, string related, string kind, string? evidence = null)
        => x.Service.AddRelationshipAsync(x.Parish, person, new AddRelationshipDto
        {
            OperationId = Guid.NewGuid(), RelatedPersonId = Guid.Parse(related), Kind = kind, Source = "Isolated office record", EvidenceReference = evidence
        }, default);
}
