// Purpose: Declares the IPeopleRepository boundary used by backend services without exposing provider
// implementation details.
// Main functions: CreateAsync, GetAsync, ListAsync, SetArchiveAsync.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.People;

public interface IPeopleRepository
{
    Task<Person> CreateAsync(Person person, Operation operation, CancellationToken ct);
    Task<Versioned<Person>?> GetAsync(string parishId, string personId, CancellationToken ct);
    Task<Page<Person>> ListAsync(string parishId, int pageSize, string? continuation, CancellationToken ct);
    Task<Person> SetArchiveAsync(string parishId, string personId, string version, bool archived, Operation operation, CancellationToken ct);
}
