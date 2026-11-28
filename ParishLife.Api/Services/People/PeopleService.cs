// Purpose: Applies access/entitlement checks to person creation, paging, office edits of the core record and archive/restore commands.
// Main functions: Authorize, CreateAsync (with the consents ticked at registration, in the same transaction), GetAsync, ListAsync,
// UpdateAsync, SetArchiveAsync; names, birth date and phone numbers are checked by PersonRules, and helpers normalize the rite and
// register status without translating or inventing values.

using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.People;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.People;

public sealed class PeopleService(IPeopleRepository people, IParishAccess access, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static string? Optional(string? value, string name, int max = 200) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, name, max);

    private async Task Authorize(string parishId, string permission, CancellationToken ct)
    {
        await access.RequireAsync(parishId, permission, ct);
        await access.RequireModuleAsync(parishId, "office", ct);
    }

    // Not in the future and not more than 110 years ago (owner, 27 November 2026).
    private void RequirePastBirthDate(DateOnly? birthDate) => PersonRules.RequireBirthDate(birthDate, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime));

    private static readonly string[] RegistrationConsents = ["Directory", "Photo", "Communications", "Event"];

    // The printed directory shows the name, phone, household and town (the registration form says so).
    private static readonly string[] RegistrationDirectoryFields = ["Name", "Phone", "Address", "Household"];

    // Recorded as granted by default at registration, never as a digital or paper acceptance by the person.
    private static PersonConsent RegistrationConsent(Person person, string kind, string by) => new()
    {
        Id = Guid.NewGuid().ToString("N"), ParishId = person.ParishId, PersonId = person.Id, Kind = kind,
        Purpose = kind switch { "Directory" => "Printed parish directory", "Photo" => "Photos in parish media", "Communications" => "Parish announcements", _ => "Parish events" },
        PolicyVersion = "registration-default", Fields = kind == "Directory" ? RegistrationDirectoryFields : [], Source = "RegistrationDefault",
        GivenBy = "Parish default at registration", RecordedBy = by, GivenAt = person.CreatedAt
    };

    private static string? Status(string? value) => string.IsNullOrWhiteSpace(value) ? null : value is "Member" or "Visitor"
        ? value : throw new DomainException("invalid_input", "Register status is Member, Visitor or not recorded.");

    public async Task<Person> CreateAsync(string parishId, CreatePersonDto request, CancellationToken ct)
    {
        await Authorize(parishId, Permissions.PeopleWrite, ct);
        RequirePastBirthDate(request.BirthDate);
        var kinds = (request.Consents ?? []).Distinct(StringComparer.Ordinal).ToArray();
        if (kinds.Any(k => !RegistrationConsents.Contains(k)))
            throw new DomainException("invalid_input", "Registration consents are Directory, Photo, Communications or Event.");
        var op = actor.CreateOperation(request.OperationId, request, clock);
        var person = new Person
        {
            Id = op.Id,
            ParishId = parishId,
            GivenName = PersonRules.Name(request.GivenName, "Given name", arabic: false),
            FamilyName = PersonRules.Name(request.FamilyName, "Family name", arabic: false),
            GivenNameAr = PersonRules.OptionalName(request.GivenNameAr, "Arabic given name", arabic: true),
            FamilyNameAr = PersonRules.OptionalName(request.FamilyNameAr, "Arabic family name", arabic: true),
            BirthDate = request.BirthDate,
            Contact = Optional(request.Contact, "Contact", 320),
            Phones = PersonRules.Phones(request.Phones),
            Rite = Optional(request.Rite, "Rite", 100),
            RegisterStatus = Status(request.RegisterStatus),
            CreatedBy = actor.AccountId,
            CreatedAt = op.At
        };
        return await people.CreateAsync(person, [.. kinds.Select(k => RegistrationConsent(person, k, actor.AccountId))], op, ct);
    }

    public async Task<Versioned<Person>> GetAsync(string parishId, string personId, CancellationToken ct)
    {
        await Authorize(parishId, Permissions.PeopleRead, ct);
        return await people.GetAsync(parishId, personId, ct) ?? throw new DomainException("person_not_found", "The person does not exist in this parish.", FailureKind.NotFound);
    }

    public async Task<Page<Person>> ListAsync(string parishId, int pageSize, string? continuation, CancellationToken ct)
    {
        await Authorize(parishId, Permissions.PeopleRead, ct);
        if (pageSize is < 1 or > 100)
            throw new DomainException("invalid_page", "Page size must be between 1 and 100.");
        return await people.ListAsync(parishId, pageSize, continuation, ct);
    }

    // Direct office correction of identity facts, so it needs an authenticator session like the other office people records.
    // A linked member's own proposals still go through the profile-correction review.
    public async Task<Versioned<Person>> UpdateAsync(string parishId, string personId, UpdatePersonDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await Authorize(parishId, Permissions.PeopleWrite, ct);
        RequirePastBirthDate(request.BirthDate);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-update:v1:" + personId);
        var current = await people.GetAsync(parishId, personId, ct) ?? throw new DomainException("person_not_found", "The person does not exist in this parish.", FailureKind.NotFound);
        var person = new Person
        {
            Id = current.Value.Id,
            ParishId = current.Value.ParishId,
            GivenName = PersonRules.Name(request.GivenName, "Given name", arabic: false),
            FamilyName = PersonRules.Name(request.FamilyName, "Family name", arabic: false),
            GivenNameAr = PersonRules.OptionalName(request.GivenNameAr, "Arabic given name", arabic: true),
            FamilyNameAr = PersonRules.OptionalName(request.FamilyNameAr, "Arabic family name", arabic: true),
            BirthDate = request.BirthDate,
            Contact = Optional(request.Contact, "Contact", 320),
            Phones = PersonRules.Phones(request.Phones),
            Rite = Optional(request.Rite, "Rite", 100),
            RegisterStatus = Status(request.RegisterStatus),
            CreatedBy = current.Value.CreatedBy,
            CreatedAt = current.Value.CreatedAt,
            UpdatedBy = actor.AccountId,
            UpdatedAt = op.At,
            Archived = current.Value.Archived
        };
        await people.UpdateAsync(person, Versions.Require(request.Version), op, ct);
        // Read back so the caller receives the new version for its next change.
        return await people.GetAsync(parishId, personId, ct) ?? throw new DomainException("person_not_found", "The person does not exist in this parish.", FailureKind.NotFound);
    }

    public async Task<Person> SetArchiveAsync(string parishId, string personId, ArchivePersonDto request, CancellationToken ct)
    {
        await Authorize(parishId, Permissions.PeopleWrite, ct);
        return await people.SetArchiveAsync(parishId, personId, Versions.Require(request.Version), request.Archived, actor.CreateOperation(request.OperationId, request, clock, "person:" + personId), ct);
    }
}
