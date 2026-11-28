// Purpose: verifies the owner's People rules of 27 November 2026 through real local services, storage and HTTP: names hold letters only
// (Latin for the English name, Arabic for the Arabic one), several Lebanese or foreign phone numbers with Lebanese prefixes and lengths
// checked, birth dates neither in the future nor more than 110 years ago, skills without digits, several languages, a typed sector,
// consents ticked at registration recorded with the person as registration defaults, and a people export without a stated purpose.
// Main tests: Names_reject_digits_symbols_and_the_other_script, Phones_follow_lebanese_prefixes_and_foreign_lengths,
// Birth_date_is_not_in_the_future_or_more_than_110_years_ago, Facts_keep_languages_sector_and_digit_free_skills,
// Registration_consents_are_recorded_with_the_create, Export_needs_no_purpose_and_lists_phones, People_rules_are_enforced_over_http.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PeopleValidationTests
{
    private const string Password = "isolated-fixture-long-password";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment)
    {
        public PeopleService People => F.Services.GetRequiredService<PeopleService>();
        public PersonFactsService Facts => F.Services.GetRequiredService<PersonFactsService>();
        public string Parish => Staff.Parish;
        public void Use() => F.AsAppointment(F.Other, Appointment);
        public DateOnly Today => DateOnly.FromDateTime(F.Clock.Now.UtcDateTime);
    }

    [Fact]
    public async Task Names_reject_digits_symbols_and_the_other_script()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var made = await x.People.CreateAsync(x.Parish, Person("  Marie-Thérèse ", "O'Neill  Abou  Jaoude", "مَرْيَم", "أبو جودة"), default);
        Assert.Equal(("Marie-Thérèse", "O'Neill Abou Jaoude", "مَرْيَم", "أبو جودة"), (made.GivenName, made.FamilyName, made.GivenNameAr, made.FamilyNameAr));

        foreach (var bad in new[]
        {
            Person("Georges2", "Haddad"), Person("Georges", "Haddad 3"), Person("Georges", "Had@dad"), Person("جورج", "Haddad"),
            Person("Georges", "Haddad", "Georges", null), Person("Georges", "Haddad", "جورج٢", null), Person("Georges", "Haddad", null, "حداد 1"),
            Person("--", "Haddad")
        })
        {
            var error = await Assert.ThrowsAsync<DomainException>(() => x.People.CreateAsync(x.Parish, bad, default));
            Assert.Equal("invalid_name", error.Code);
        }
        Assert.Contains("not digits", (await Assert.ThrowsAsync<DomainException>(() => x.People.CreateAsync(x.Parish, Person("Georges2", "Haddad"), default))).Message);

        // The office edit applies the same rule.
        var row = await x.People.GetAsync(x.Parish, made.Id, default);
        var edit = new UpdatePersonDto { OperationId = Guid.NewGuid(), Version = row.Version, GivenName = "Marie", FamilyName = "Haddad", GivenNameAr = "Marie" };
        Assert.Equal("invalid_name", (await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, made.Id, edit, default))).Code);
        Assert.Equal("Haddad", (await x.People.UpdateAsync(x.Parish, made.Id, new UpdatePersonDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, GivenName = "Marie", FamilyName = "Haddad", GivenNameAr = "مريم"
        }, default)).Value.FamilyName);
    }

    [Fact]
    public async Task Phones_follow_lebanese_prefixes_and_foreign_lengths()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var request = Person("Georges", "Haddad");
        request.Phones =
        [
            new PersonPhoneDto { Number = "71 821 056" }, new PersonPhoneDto { Number = "03 123 456" }, new PersonPhoneDto { Number = "+961 1 234 567", Kind = "Mobile" },
            new PersonPhoneDto { Number = "+33 6 12 34 56 78", Kind = "Mobile" }, new PersonPhoneDto { Number = "0096171821056" }
        ];
        var made = await x.People.CreateAsync(x.Parish, request, default);
        // Lebanese kinds come from the prefix (the Mobile sent for a Beirut landline is not kept); the repeated number is kept once.
        Assert.Equal(
            new (string, string?)[] { ("+96171821056", "Mobile"), ("+9613123456", "Mobile"), ("+9611234567", "Landline"), ("+33612345678", "Mobile") },
            made.Phones.Select(p => (p.Number, p.Kind)).ToArray());

        foreach (var number in new[] { "71 821 0", "70 1234", "71 821 0567", "03 123 4567", "02 123 456", "80 123 456", "123", "+1 23", "phone 71821056", "+961 71+821056" })
        {
            var bad = Person("Georges", "Haddad");
            bad.Phones = [new PersonPhoneDto { Number = number }];
            Assert.Equal("invalid_phone", (await Assert.ThrowsAsync<DomainException>(() => x.People.CreateAsync(x.Parish, bad, default))).Code);
        }
        var many = Person("Georges", "Haddad");
        many.Phones = [.. Enumerable.Range(0, 6).Select(i => new PersonPhoneDto { Number = "71 821 05" + i })];
        Assert.Equal("invalid_phone", (await Assert.ThrowsAsync<DomainException>(() => x.People.CreateAsync(x.Parish, many, default))).Code);

        // An edit replaces the list; archive keeps it; an empty list removes every number.
        var row = await x.People.GetAsync(x.Parish, made.Id, default);
        var updated = await x.People.UpdateAsync(x.Parish, made.Id, new UpdatePersonDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, GivenName = "Georges", FamilyName = "Haddad", Phones = [new PersonPhoneDto { Number = "81 123 456" }]
        }, default);
        Assert.Equal(("+96181123456", "Mobile"), (Assert.Single(updated.Value.Phones).Number, updated.Value.Phones[0].Kind));
        var archived = await x.People.SetArchiveAsync(x.Parish, made.Id, new ArchivePersonDto { OperationId = Guid.NewGuid(), Version = updated.Version, Archived = true }, default);
        Assert.Equal("+96181123456", Assert.Single(archived.Phones).Number);
    }

    [Fact]
    public async Task Birth_date_is_not_in_the_future_or_more_than_110_years_ago()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var oldest = Person("Georges", "Haddad");
        oldest.BirthDate = x.Today.AddYears(-110);
        Assert.Equal(x.Today.AddYears(-110), (await x.People.CreateAsync(x.Parish, oldest, default)).BirthDate);
        var today = Person("Maya", "Haddad");
        today.BirthDate = x.Today;
        await x.People.CreateAsync(x.Parish, today, default);

        foreach (var date in new[] { x.Today.AddDays(1), x.Today.AddYears(-110).AddDays(-1), new DateOnly(1800, 1, 1) })
        {
            var bad = Person("Georges", "Haddad");
            bad.BirthDate = date;
            Assert.Equal("invalid_birth_date", (await Assert.ThrowsAsync<DomainException>(() => x.People.CreateAsync(x.Parish, bad, default))).Code);
        }
        var row = await x.People.GetAsync(x.Parish, (await x.People.CreateAsync(x.Parish, Person("Rita", "Haddad"), default)).Id, default);
        Assert.Equal("invalid_birth_date", (await Assert.ThrowsAsync<DomainException>(() => x.People.UpdateAsync(x.Parish, row.Value.Id, new UpdatePersonDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, GivenName = "Rita", FamilyName = "Haddad", BirthDate = x.Today.AddYears(-111)
        }, default))).Code);
    }

    [Fact]
    public async Task Facts_keep_languages_sector_and_digit_free_skills()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var person = (await x.People.CreateAsync(x.Parish, Person("Georges", "Haddad"), default)).Id;
        var saved = await x.Facts.SaveFactsAsync(x.Parish, person, new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Region = "Mount Lebanon", District = "Baabda", Town = "Hadath", Sector = "Isolated sector",
            Skills = ["First aid", " Choir  singing ", "first aid"], Languages = ["ar", "EN", "fr", "ar"], PreferredLanguage = "ar"
        }, default);
        Assert.Equal(("Isolated sector", "ar,en,fr"), (saved.Sector, string.Join(',', saved.Languages)));
        Assert.Equal(new[] { "First aid", "Choir singing" }, saved.Skills);
        var stored = await x.Facts.GetFactsAsync(x.Parish, person, default);
        Assert.Equal(("Isolated sector", 3), (stored.Value.Sector, stored.Value.Languages.Length));

        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Facts.SaveFactsAsync(x.Parish, person, new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Version = stored.Version, Skills = ["Driver 2"]
        }, default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Facts.SaveFactsAsync(x.Parish, person, new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Version = stored.Version, Languages = ["english"]
        }, default))).Code);
    }

    [Fact]
    public async Task Registration_consents_are_recorded_with_the_create()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.Use();
        var request = Person("Isolated", "Consents");
        request.Consents = ["Directory", "Photo", "Communications", "Event"];
        var created = await x.People.CreateAsync(x.Parish, request, default);
        var consents = await x.Facts.ConsentsAsync(x.Parish, created.Id, default);
        Assert.Equal(["Communications", "Directory", "Event", "Photo"], consents.Select(c => c.Value.Kind).Order().ToArray());
        Assert.All(consents, c => Assert.Equal(("RegistrationDefault", "Given", "registration-default", "Parish default at registration"),
            (c.Value.Source, c.Value.Status, c.Value.PolicyVersion, c.Value.GivenBy)));
        Assert.Equal(["Name", "Phone", "Address", "Household"], consents.Single(c => c.Value.Kind == "Directory").Value.Fields);
        // Replaying the same create records nothing twice.
        await x.People.CreateAsync(x.Parish, request, default);
        Assert.Equal(4, (await x.Facts.ConsentsAsync(x.Parish, created.Id, default)).Count);
        // Any of them can be withdrawn afterwards like any other consent.
        var photo = consents.Single(c => c.Value.Kind == "Photo");
        Assert.Equal("Withdrawn", (await x.Facts.WithdrawConsentAsync(x.Parish, photo.Value.Id, new WithdrawConsentDto { OperationId = Guid.NewGuid(), Version = photo.Version }, default)).Status);

        // Nothing ticked: no consent is recorded; a kind that is not a registration consent refuses the create.
        var plain = await x.People.CreateAsync(x.Parish, Person("Isolated", "Plain"), default);
        Assert.Empty(await x.Facts.ConsentsAsync(x.Parish, plain.Id, default));
        var bad = Person("Isolated", "Representation");
        bad.Consents = ["Representation"];
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.People.CreateAsync(x.Parish, bad, default))).Code);
    }

    [Fact]
    public async Task Export_needs_no_purpose_and_lists_phones()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var exporter = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(x.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Staff.Parishes.GetAsync(x.Parish, default))!.Version,
            AccountId = Guid.Parse(exporter), Allows = [Permissions.PeopleRead, Permissions.ExportsManage], StartsAt = f.Clock.Now
        }, default);
        x.Use();
        var request = Person("Georges", "Haddad");
        request.Phones = [new PersonPhoneDto { Number = "71 821 056" }, new PersonPhoneDto { Number = "01 234 567" }];
        await x.People.CreateAsync(x.Parish, request, default);

        f.As(exporter);
        var csv = await f.Services.GetRequiredService<PeopleDirectoryService>().ExportAsync(x.Parish, new PeopleExportDto
        {
            OperationId = Guid.NewGuid(), Purpose = "  ", Columns = ["GivenName", "Phones"]
        }, default);
        // A leading + is neutralized like any spreadsheet formula.
        Assert.Equal("GivenName,Phones\r\nGeorges,'+96171821056 +9611234567\r\n", csv);
        var log = Assert.Single(await f.Services.GetRequiredService<IRecordTransactions>().CollectAsync<ExportLog>(
            new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "exportLog", default, 10)).Value;
        Assert.Equal((exporter, "Not stated", 1), (log.By, log.Purpose, log.Count));
    }

    [Fact]
    public async Task People_rules_are_enforced_over_http()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        await scenario.ActivateOfficeAsync(["core", "office"]);
        var appointment = await scenario.AcceptAsync(await scenario.InviteAsync(fixture.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        Assert.StartsWith(Path.GetTempPath(), fixture.DirectoryPath, StringComparison.OrdinalIgnoreCase);
        using var office = factory.Client();
        await SignInAsync(office, "other@fixture.example");
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", Guid.Parse(appointment.Id).ToString("D"));
        var root = $"/api/parishes/{scenario.Parish}";
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        async Task<string> RefusedAsync(object body, string path = "/people")
        {
            var response = await office.PostAsJsonAsync(root + path, body);
            var text = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest, response.StatusCode + ": " + text);
            return text;
        }
        // DTO validation names the field for digits and the wrong script; the service refuses bad phones and birth dates.
        Assert.Contains("not digits", await RefusedAsync(new { operationId = Guid.NewGuid(), givenName = "Georges2", familyName = "Haddad" }));
        Assert.Contains("Arabic letters", await RefusedAsync(new { operationId = Guid.NewGuid(), givenName = "Georges", familyName = "Haddad", familyNameAr = "Haddad" }));
        Assert.Contains("Lebanese number", await RefusedAsync(new
        {
            operationId = Guid.NewGuid(), givenName = "Georges", familyName = "Haddad", phones = new[] { new { number = "76 22 04" } }
        }));
        Assert.Contains("110 years", await RefusedAsync(new { operationId = Guid.NewGuid(), givenName = "Georges", familyName = "Haddad", birthDate = today.AddYears(-111) }));
        Assert.Contains("future", await RefusedAsync(new { operationId = Guid.NewGuid(), givenName = "Georges", familyName = "Haddad", birthDate = today.AddDays(1) }));

        var created = await ReadAsync<PersonDto>(await office.PostAsJsonAsync(root + "/people", new
        {
            operationId = Guid.NewGuid(), givenName = "Georges", familyName = "Haddad", givenNameAr = "جورج", familyNameAr = "حداد",
            birthDate = today.AddYears(-40), phones = new object[] { new { number = "71 821 056" }, new { number = "+44 20 7946 0958", kind = "Landline" } }
        }));
        Assert.Equal(new[] { "+96171821056", "+442079460958" }, created.Phones.Select(p => p.Number).ToArray());
        Assert.Equal(new string?[] { "Mobile", "Landline" }, created.Phones.Select(p => p.Kind).ToArray());
        var row = await ReadAsync<Versioned<PersonDto>>(await office.GetAsync($"{root}/people/{created.Id}"));
        Assert.Equal(2, row.Value.Phones.Length);
        var put = await office.PutAsJsonAsync($"{root}/people/{created.Id}", new
        {
            operationId = Guid.NewGuid(), version = row.Version, givenName = "Georges", familyName = "Haddad 2"
        });
        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);

        var skills = await office.PutAsJsonAsync($"{root}/people/{created.Id}/facts", new { operationId = Guid.NewGuid(), skills = new[] { "Driver 2" } });
        Assert.Equal(HttpStatusCode.BadRequest, skills.StatusCode);
        var facts = await ReadAsync<PersonFactsDto>(await office.PutAsJsonAsync($"{root}/people/{created.Id}/facts", new
        {
            operationId = Guid.NewGuid(), languages = new[] { "ar", "fr" }, sector = "Isolated sector", skills = new[] { "First aid" }
        }));
        Assert.Equal(("ar,fr", "Isolated sector"), (string.Join(',', facts.Languages), facts.Sector));
    }

    private static CreatePersonDto Person(string given, string family, string? givenAr = null, string? familyAr = null) => new()
    {
        OperationId = Guid.NewGuid(), GivenName = given, FamilyName = family, GivenNameAr = givenAr, FamilyNameAr = familyAr
    };

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        return new Setup(f, staff, appointment.Id);
    }

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
