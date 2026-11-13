// Purpose: verifies the people record additions through real local services and storage: Arabic name twins, rite and register
// status on a person; the office edit of name, birth date and contact; the parish-wide facts page (town with its Arabic twin);
// households with Arabic name, town and members in the list; the parish-wide consent list for the printed directory; and an
// HTTP pass over the new routes with real cookies, MFA, CSRF and isolated storage.
// Main tests: People_keep_arabic_twins_rite_and_status_and_the_office_edits_the_core_record,
// People_office_edit_is_denied_without_write_mfa_or_a_current_version, People_facts_page_and_directory_consents_are_parish_wide_for_readers_only,
// People_households_keep_arabic_name_town_and_list_their_members, People_merge_and_search_cover_the_new_fields,
// People_record_routes_work_over_http.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PeopleRecordTests
{
    private const string Password = "isolated-fixture-long-password";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment)
    {
        public PeopleService People => F.Services.GetRequiredService<PeopleService>();
        public PersonFactsService Facts => F.Services.GetRequiredService<PersonFactsService>();
        public HouseholdService Households => F.Services.GetRequiredService<HouseholdService>();
        public string Parish => Staff.Parish;
        public void Use() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task People_keep_arabic_twins_rite_and_status_and_the_office_edits_the_core_record()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var created = await x.People.CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Twin", GivenNameAr = " يوسف ", FamilyNameAr = "الحداد",
            Rite = "Isolated rite", RegisterStatus = "Visitor", BirthDate = new DateOnly(1990, 5, 1), Contact = "twin@fixture.example"
        }, default);
        Assert.Equal(("يوسف", "الحداد", "Isolated rite", "Visitor"), (created.GivenNameAr, created.FamilyNameAr, created.Rite, created.RegisterStatus));
        Assert.Null(created.UpdatedBy);
        var plain = await x.People.CreateAsync(x.Parish, new CreatePersonDto { OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Latin only" }, default);
        // Neither language is filled from the other.
        Assert.Equal(((string?)null, (string?)null, (string?)null, (string?)null), (plain.GivenNameAr, plain.FamilyNameAr, plain.Rite, plain.RegisterStatus));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.People.CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Clergy label", RegisterStatus = "Clergy"
        }, default))).Code);

        var row = await x.People.GetAsync(x.Parish, created.Id, default);
        var edit = new UpdatePersonDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, GivenName = "Isolated", FamilyName = "Corrected", GivenNameAr = "يوسف",
            FamilyNameAr = "", BirthDate = new DateOnly(1991, 6, 2), Contact = "  ", Rite = null, RegisterStatus = "Member"
        };
        var updated = await x.People.UpdateAsync(x.Parish, created.Id, edit, default);
        Assert.NotEqual(row.Version, updated.Version);
        Assert.Equal(("Corrected", "يوسف", (string?)null, new DateOnly(1991, 6, 2)), (updated.Value.FamilyName, updated.Value.GivenNameAr, updated.Value.FamilyNameAr, updated.Value.BirthDate));
        Assert.Equal(((string?)null, (string?)null, "Member"), (updated.Value.Contact, updated.Value.Rite, updated.Value.RegisterStatus));
        Assert.Equal((f.Other, f.Clock.Now, created.CreatedAt), (updated.Value.UpdatedBy, updated.Value.UpdatedAt!.Value, updated.Value.CreatedAt));
        // The same operation replays its first result; a new operation with the old version is a conflict.
        Assert.Equal("Corrected", (await x.People.UpdateAsync(x.Parish, created.Id, edit, default)).Value.FamilyName);
        edit.OperationId = Guid.NewGuid();
        edit.FamilyName = "Stale";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, created.Id, edit, default))).Code);

        // Archive and restore keep the new fields.
        var archived = await x.People.SetArchiveAsync(x.Parish, created.Id, new ArchivePersonDto
        {
            OperationId = Guid.NewGuid(), Version = updated.Version, Archived = true
        }, default);
        Assert.Equal((true, "يوسف", "Member"), (archived.Archived, archived.GivenNameAr, archived.RegisterStatus));
        var listed = (await x.People.ListAsync(x.Parish, 100, null, default)).Items.Single(p => p.Id == created.Id);
        Assert.Equal(("Corrected", "يوسف", true), (listed.FamilyName, listed.GivenNameAr, listed.Archived));
    }

    [Fact]
    public async Task People_office_edit_is_denied_without_write_mfa_or_a_current_version()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var person = await x.People.CreateAsync(x.Parish, new CreatePersonDto { OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Guarded" }, default);
        var version = (await x.People.GetAsync(x.Parish, person.Id, default)).Version;
        UpdatePersonDto Edit(string? v) => new() { OperationId = Guid.NewGuid(), Version = v ?? "", GivenName = "Isolated", FamilyName = "Changed" };

        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, person.Id, Edit(null), default))).Code);
        var future = Edit(version);
        future.BirthDate = DateOnly.FromDateTime(f.Clock.Now.UtcDateTime).AddDays(1);
        Assert.Equal("invalid_birth_date", (await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, person.Id, future, default))).Code);
        Assert.Equal("person_not_found", (await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, Guid.NewGuid().ToString("N"), Edit(version), default))).Code);

        // The same appointment without an authenticator session cannot edit.
        f.As(f.Other, mfa: false);
        f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext!.Request.Headers["X-ParishLife-Appointment"] = x.Appointment;
        await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, person.Id, Edit(version), default));

        // A reader can read but not edit; an unrelated member can do neither.
        var reader = await GrantReaderAsync(x);
        f.As(reader);
        Assert.Equal("Guarded", (await x.People.GetAsync(x.Parish, person.Id, default)).Value.FamilyName);
        await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, person.Id, Edit(version), default));
        f.As(await f.CreateVerifiedMemberAsync());
        await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, person.Id, Edit(version), default));

        x.Use();
        Assert.Equal("Guarded", (await x.People.GetAsync(x.Parish, person.Id, default)).Value.FamilyName);
    }

    [Fact]
    public async Task People_facts_page_and_directory_consents_are_parish_wide_for_readers_only()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var a = await PersonAsync(x, "Alpha");
        var b = await PersonAsync(x, "Beta");
        await PersonAsync(x, "Gamma");
        await x.Facts.SaveFactsAsync(x.Parish, a, new SavePersonFactsDto { OperationId = Guid.NewGuid(), Town = "Isolated town", TownAr = "بلدة معزولة" }, default);
        await x.Facts.SaveFactsAsync(x.Parish, b, new SavePersonFactsDto { OperationId = Guid.NewGuid(), TownAr = "بلدة فقط" }, default);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Facts.SaveFactsAsync(x.Parish, b, new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Version = "any", TownAr = "بلدة", LocalityNotListed = "Unlisted place"
        }, default))).Code);

        var first = await x.Facts.ListFactsAsync(x.Parish, 1, null, default);
        Assert.Single(first.Items);
        Assert.NotNull(first.ContinuationToken);
        var all = (await x.Facts.ListFactsAsync(x.Parish, 100, null, default)).Items;
        Assert.Equal(2, all.Count);
        var alpha = all.Single(r => r.Value.PersonId == a);
        Assert.Equal(("Isolated town", "بلدة معزولة", "Listed"), (alpha.Value.Town, alpha.Value.TownAr, alpha.Value.LocalityStatus));
        Assert.Equal(((string?)null, "بلدة فقط", "Listed"), (all.Single(r => r.Value.PersonId == b).Value.Town, all.Single(r => r.Value.PersonId == b).Value.TownAr,
            all.Single(r => r.Value.PersonId == b).Value.LocalityStatus));
        Assert.Equal(alpha.Version, (await x.Facts.GetFactsAsync(x.Parish, a, default)).Version);

        var directoryA = await x.Facts.RecordConsentAsync(x.Parish, a, Consent("Directory", ["Name", "Phone"]), default);
        await x.Facts.RecordConsentAsync(x.Parish, b, Consent("Directory", ["Name"]), default);
        await x.Facts.RecordConsentAsync(x.Parish, b, Consent("Photo", []), default);
        var given = (await x.Facts.ParishConsentsAsync(x.Parish, "Directory", false, 100, null, default)).Items;
        Assert.Equal(new[] { a, b }.OrderBy(i => i), given.Select(r => r.Value.PersonId).OrderBy(i => i));
        Assert.Equal(new[] { "Name", "Phone" }, given.Single(r => r.Value.PersonId == a).Value.Fields);
        var row = given.Single(r => r.Value.Id == directoryA.Id);
        await x.Facts.WithdrawConsentAsync(x.Parish, directoryA.Id, new WithdrawConsentDto { OperationId = Guid.NewGuid(), Version = row.Version, Reason = "Isolated withdrawal" }, default);
        Assert.Equal(b, Assert.Single((await x.Facts.ParishConsentsAsync(x.Parish, "Directory", false, 100, null, default)).Items).Value.PersonId);
        var withWithdrawn = (await x.Facts.ParishConsentsAsync(x.Parish, "Directory", true, 100, null, default)).Items;
        Assert.Contains(withWithdrawn, r => r.Value.Id == directoryA.Id && r.Value.Status == "Withdrawn");
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Facts.ParishConsentsAsync(x.Parish, "Everything", false, 100, null, default))).Code);
        Assert.Equal("invalid_page", (await Assert.ThrowsAsync<DomainException>(() => x.Facts.ListFactsAsync(x.Parish, 101, null, default))).Code);

        // Readers see both lists; without an authenticator session, or without people.read, neither is available.
        var reader = await GrantReaderAsync(x);
        f.As(reader);
        Assert.Equal(2, (await x.Facts.ListFactsAsync(x.Parish, 100, null, default)).Items.Count);
        Assert.Single((await x.Facts.ParishConsentsAsync(x.Parish, "Directory", false, 100, null, default)).Items);
        f.As(reader, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Facts.ListFactsAsync(x.Parish, 100, null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Facts.ParishConsentsAsync(x.Parish, "Directory", false, 100, null, default));
        f.As(await f.CreateVerifiedStaffAsync());
        await Assert.ThrowsAsync<DomainException>(() => x.Facts.ListFactsAsync(x.Parish, 100, null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Facts.ParishConsentsAsync(x.Parish, "Directory", false, 100, null, default));
    }

    [Fact]
    public async Task People_households_keep_arabic_name_town_and_list_their_members()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var arabic = (await x.People.CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Arabic", GivenNameAr = "مريم", FamilyNameAr = "الخوري"
        }, default)).Id;
        var latin = await PersonAsync(x, "Latin");
        var home = await x.Households.SaveAsync(x.Parish, null, new SaveHouseholdDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated family", NameAr = "عائلة معزولة", Town = "Isolated town", TownAr = "بلدة معزولة"
        }, default);
        Assert.Equal(("عائلة معزولة", "Isolated town", "بلدة معزولة"), (home.NameAr, home.Town, home.TownAr));
        var empty = await x.Households.SaveAsync(x.Parish, null, new SaveHouseholdDto { OperationId = Guid.NewGuid(), Name = "Isolated empty" }, default);
        Assert.Equal(((string?)null, (string?)null, (string?)null), (empty.NameAr, empty.Town, empty.TownAr));
        foreach (var person in new[] { arabic, latin })
            await x.Households.MemberAsync(x.Parish, home.Id, new HouseholdMemberActionDto
            {
                OperationId = Guid.NewGuid(), Version = (await x.Households.GetAsync(x.Parish, home.Id, default)).Version, PersonId = Guid.Parse(person),
                Action = "add", InheritsAddress = true
            }, default);

        var list = (await x.Households.ListAsync(x.Parish, 100, null, default)).Items;
        var listed = list.Single(r => r.Value.Id == home.Id);
        Assert.Equal(listed.Version, (await x.Households.GetAsync(x.Parish, home.Id, default)).Version);
        Assert.Equal(2, listed.Value.Members.Length);
        Assert.Equal("مريم الخوري", listed.Value.Members.Single(m => m.PersonId == arabic).DisplayNameAr);
        Assert.Null(listed.Value.Members.Single(m => m.PersonId == latin).DisplayNameAr);
        Assert.Empty(list.Single(r => r.Value.Id == empty.Id).Value.Members);

        var moved = await x.Households.SaveAsync(x.Parish, home.Id, new SaveHouseholdDto
        {
            OperationId = Guid.NewGuid(), Version = listed.Version, Name = "Isolated family", NameAr = "عائلة معزولة", Town = "Other town", TownAr = null
        }, default);
        Assert.Equal(("Other town", (string?)null), (moved.Town, moved.TownAr));
        var history = (await x.Households.HistoryAsync(x.Parish, home.Id, 50, null, default)).Items;
        Assert.Equal("Isolated town", Assert.Single(history, h => h.Action == "town").Previous);
    }

    [Fact]
    public async Task People_merge_and_search_cover_the_new_fields()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var survivor = (await x.People.CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Merged", GivenNameAr = "إيلي", RegisterStatus = "Member"
        }, default)).Id;
        var source = (await x.People.CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Merged", FamilyNameAr = "المعزول", Rite = "Isolated rite"
        }, default)).Id;
        var search = f.Services.GetRequiredService<PeopleDirectoryService>();
        var found = Assert.Single(await search.SearchAsync(x.Parish, "ايلي", false, 25, default));
        Assert.Equal((survivor, "إيلي"), (found.Id, found.GivenNameAr));
        var duplicates = f.Services.GetRequiredService<DuplicateService>();
        var preview = await duplicates.PreviewMergeAsync(x.Parish, survivor, source, default);
        Assert.Equal(new[] { "GivenNameAr", "FamilyNameAr", "Rite", "RegisterStatus" }, preview.Conflicts);
        var merge = await duplicates.MergeAsync(x.Parish, new MergePeopleDto
        {
            OperationId = Guid.NewGuid(), SurvivorId = Guid.Parse(survivor), SourceId = Guid.Parse(source), Reason = "Isolated duplicate review",
            Choices = new() { ["GivenNameAr"] = "survivor", ["FamilyNameAr"] = "source", ["Rite"] = "source", ["RegisterStatus"] = "survivor" }
        }, default);
        Assert.Equal("Merged", merge.Status);
        var kept = (await x.People.GetAsync(x.Parish, survivor, default)).Value;
        Assert.Equal(("إيلي", "المعزول", "Isolated rite", "Member"), (kept.GivenNameAr, kept.FamilyNameAr, kept.Rite, kept.RegisterStatus));
    }

    [Fact]
    public async Task People_record_routes_work_over_http()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        await scenario.ActivateOfficeAsync(["core", "office"]);
        var appointment = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var office = factory.Client();
        using var outsider = factory.Client();
        await SignInAsync(office, "other@fixture.example");
        await SignInAsync(outsider, "nominee@fixture.example");
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", Guid.Parse(appointment.Id).ToString("D"));
        var root = $"/api/parishes/{scenario.Parish}";

        var created = await ReadAsync<PersonDto>(await office.PostAsJsonAsync(root + "/people", new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Http", GivenNameAr = "جورج", RegisterStatus = "Visitor"
        }));
        Assert.Equal(("جورج", "Visitor"), (created.GivenNameAr, created.RegisterStatus));
        Assert.Equal(HttpStatusCode.BadRequest, (await office.PostAsJsonAsync(root + "/people", new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Bad status", RegisterStatus = "member"
        })).StatusCode);
        var row = await ReadAsync<Versioned<PersonDto>>(await office.GetAsync($"{root}/people/{created.Id}"));
        var updated = await ReadAsync<Versioned<PersonDto>>(await office.PutAsJsonAsync($"{root}/people/{created.Id}", new UpdatePersonDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, GivenName = "Isolated", FamilyName = "Http edited", GivenNameAr = "جورج",
            FamilyNameAr = "الطويل", Contact = "http@fixture.example", RegisterStatus = "Member"
        }));
        Assert.Equal(("Http edited", "الطويل", "Member"), (updated.Value.FamilyName, updated.Value.FamilyNameAr, updated.Value.RegisterStatus));
        var stale = await office.PutAsJsonAsync($"{root}/people/{created.Id}", new UpdatePersonDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, GivenName = "Isolated", FamilyName = "Stale"
        });
        Assert.True(stale.StatusCode == HttpStatusCode.Conflict, stale.StatusCode + ": " + await stale.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.PutAsJsonAsync($"{root}/people/{created.Id}", new UpdatePersonDto
        {
            OperationId = Guid.NewGuid(), Version = updated.Version, GivenName = "Isolated", FamilyName = "Outsider"
        })).StatusCode);

        await ReadAsync<PersonFactsDto>(await office.PutAsJsonAsync($"{root}/people/{created.Id}/facts", new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Town = "Isolated town", TownAr = "بلدة"
        }));
        var facts = await ReadAsync<Page<Versioned<PersonFactsDto>>>(await office.GetAsync(root + "/people/facts?size=100"));
        Assert.Equal("بلدة", Assert.Single(facts.Items).Value.TownAr);
        await ReadAsync<ConsentDto>(await office.PostAsJsonAsync($"{root}/people/{created.Id}/consents", Consent("Directory", ["Name", "Household"])));
        var consents = await ReadAsync<Page<Versioned<ConsentDto>>>(await office.GetAsync(root + "/consents?kind=Directory"));
        Assert.Equal(created.Id, Assert.Single(consents.Items).Value.PersonId);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync(root + "/consents?kind=Directory")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync(root + "/people/facts")).StatusCode);

        var household = await ReadAsync<HouseholdDto>(await office.PostAsJsonAsync(root + "/households", new SaveHouseholdDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated household", NameAr = "بيت", Town = "Isolated town"
        }));
        var version = (await ReadAsync<Versioned<HouseholdDto>>(await office.GetAsync($"{root}/households/{household.Id}"))).Version;
        await ReadAsync<HouseholdDto>(await office.PostAsJsonAsync($"{root}/households/{household.Id}/members", new HouseholdMemberActionDto
        {
            OperationId = Guid.NewGuid(), Version = version, PersonId = Guid.Parse(created.Id), Action = "add", InheritsAddress = true
        }));
        var households = await ReadAsync<Page<Versioned<HouseholdDto>>>(await office.GetAsync(root + "/households?size=100"));
        var listed = Assert.Single(households.Items).Value;
        Assert.Equal(("بيت", "Isolated town", "جورج الطويل"), (listed.NameAr, listed.Town, Assert.Single(listed.Members).DisplayNameAr));
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        return new Setup(f, staff, appointment.Id);
    }

    private static async Task<string> GrantReaderAsync(Setup x)
    {
        var reader = await x.F.CreateVerifiedStaffAsync();
        x.F.As(x.F.FirstAdmin);
        await x.F.Services.GetRequiredService<ParishService>().GrantAsync(x.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Staff.Parishes.GetAsync(x.Parish, default))!.Version,
            AccountId = Guid.Parse(reader), Allows = [Permissions.PeopleRead], StartsAt = x.F.Clock.Now
        }, default);
        return reader;
    }

    // The caller selects the office appointment first: setting the HTTP context inside an async helper would not flow back.
    private static async Task<string> PersonAsync(Setup x, string name)
    {
        return (await x.People.CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = name, FamilyName = "Isolated", BirthDate = new DateOnly(1980, 1, 1)
        }, default)).Id;
    }

    private static RecordConsentDto Consent(string kind, string[] fields) => new()
    {
        OperationId = Guid.NewGuid(), Kind = kind, Purpose = "Isolated purpose", PolicyVersion = "isolated-v1", Fields = fields, GivenBy = "Self (paper form)"
    };

    private static async Task SignInAsync(HttpClient client, string username)
    {
        await CsrfAsync(client);
        var pending = await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username, password = Password }));
        var challenge = pending.GetProperty("challenge");
        await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
        {
            accountId = challenge.GetProperty("accountId").GetString(),
            challenge = challenge.GetProperty("challenge").GetString(),
            code = TestAuthenticator.Code()
        }));
        await CsrfAsync(client);
    }

    private static async Task CsrfAsync(HttpClient client)
    {
        var response = await ReadAsync<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", response.GetProperty("token").GetString());
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }
}
