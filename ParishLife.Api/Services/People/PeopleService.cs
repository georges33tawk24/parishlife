// Purpose: Applies access/entitlement checks to person creation, paging, and archive/restore commands.
// Main functions: Authorize, CreateAsync, GetAsync, ListAsync, SetArchiveAsync.

using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.People;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.People;

public sealed class PeopleService(IPeopleRepository people, IParishAccess access, ICurrentActor actor, TimeProvider clock)
{
    private async Task Authorize(string parishId, string permission, CancellationToken ct)
    {
        await access.RequireAsync(parishId, permission, ct);
        await access.RequireModuleAsync(parishId, "office", ct);
    }

    public async Task<Person> CreateAsync(string parishId, CreatePersonDto request, CancellationToken ct)
    {
        await Authorize(parishId, Permissions.PeopleWrite, ct);
        if (request.BirthDate is { } date && date > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime))
            throw new DomainException("invalid_birth_date", "Birth date cannot be in the future.");
        var op = actor.CreateOperation(request.OperationId, request, clock);
        var person = new Person
        {
            Id = op.Id,
            ParishId = parishId,
            GivenName = Guard.Text(request.GivenName, "Given name"),
            FamilyName = Guard.Text(request.FamilyName, "Family name"),
            BirthDate = request.BirthDate,
            Contact = string.IsNullOrWhiteSpace(request.Contact) ? null : Guard.Text(request.Contact, "Contact", 320),
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

    public async Task<Person> SetArchiveAsync(string parishId, string personId, ArchivePersonDto request, CancellationToken ct)
    {
        await Authorize(parishId, Permissions.PeopleWrite, ct);
        return await people.SetArchiveAsync(parishId, personId, Versions.Require(request.Version), request.Archived, actor.CreateOperation(request.OperationId, request, clock, "person:" + personId), ct);
    }
}
