// Purpose: Applies access/entitlement checks to person creation, paging, office edits of the core record and archive/restore commands.
// Main functions: Authorize, CreateAsync, GetAsync, ListAsync, UpdateAsync, SetArchiveAsync; helpers normalize the optional
// Arabic name twins, rite and register status without translating or inventing values.

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

    private void RequirePastBirthDate(DateOnly? birthDate)
    {
        if (birthDate is { } date && date > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime))
            throw new DomainException("invalid_birth_date", "Birth date cannot be in the future.");
    }

    private static string? Status(string? value) => string.IsNullOrWhiteSpace(value) ? null : value is "Member" or "Visitor"
        ? value : throw new DomainException("invalid_input", "Register status is Member, Visitor or not recorded.");

    public async Task<Person> CreateAsync(string parishId, CreatePersonDto request, CancellationToken ct)
    {
        await Authorize(parishId, Permissions.PeopleWrite, ct);
        RequirePastBirthDate(request.BirthDate);
        var op = actor.CreateOperation(request.OperationId, request, clock);
        var person = new Person
        {
            Id = op.Id,
            ParishId = parishId,
            GivenName = Guard.Text(request.GivenName, "Given name"),
            FamilyName = Guard.Text(request.FamilyName, "Family name"),
            GivenNameAr = Optional(request.GivenNameAr, "Arabic given name"),
            FamilyNameAr = Optional(request.FamilyNameAr, "Arabic family name"),
            BirthDate = request.BirthDate,
            Contact = Optional(request.Contact, "Contact", 320),
            Rite = Optional(request.Rite, "Rite", 100),
            RegisterStatus = Status(request.RegisterStatus),
            CreatedBy = actor.AccountId,
            CreatedAt = op.At
        };
        return await people.CreateAsync(person, op, ct);
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
            GivenName = Guard.Text(request.GivenName, "Given name"),
            FamilyName = Guard.Text(request.FamilyName, "Family name"),
            GivenNameAr = Optional(request.GivenNameAr, "Arabic given name"),
            FamilyNameAr = Optional(request.FamilyNameAr, "Arabic family name"),
            BirthDate = request.BirthDate,
            Contact = Optional(request.Contact, "Contact", 320),
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
