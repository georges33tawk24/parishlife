// Purpose: Reads and saves parish-owned people with scoped paging, ETags, and operation history.
// Main functions: P, GetAsync, CreateAsync, ListAsync, UpdateAsync, SetArchiveAsync, ReplaceAsync, InvalidCursor.

using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.People;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using static ParishLife.Api.Data.Cosmos.JsonDefaults;

namespace ParishLife.Api.Repositories.People;

internal sealed class PeopleRepository(PartitionDocuments documents, IDataProtectionProvider protection) : IPeopleRepository
{
    private const string C = Containers.TenantControl;
    private static string P(string id) => "parish:" + id;
    private readonly IDataProtector protector = protection.CreateProtector("ParishLife.PeopleCursor.v1");
    private sealed record Cursor(string ParishId, int PageSize, string QueryVersion, string? Token);
    public Task<Versioned<Person>?> GetAsync(string parishId, string personId, CancellationToken ct) => documents.ReadAsync<Person>(C, P(parishId), "person:" + personId, ct);
    public async Task<Person> CreateAsync(Person person, Operation operation, CancellationToken ct)
    {
        var key = P(person.ParishId);
        if (await documents.ReplayAsync<Person>(C, key, operation, ct) is { } prior)
            return prior;
        try
        {
            await documents.CommitAsync(documents.Batch(C, key).CreateItem(Row("person:" + person.Id, key, "person", person)).CreateItem(Receipt(key, operation, person)).CreateItem(Audit(key, operation, "person.create", person.Id)), ct);
            return person;
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            var replay = await documents.ReplayAsync<Person>(C, key, operation, ct);
            if (replay is not null)
                return replay;
            throw;
        }
    }

    public async Task<Page<Person>> ListAsync(string parishId, int pageSize, string? continuation, CancellationToken ct)
    {
        string? token = null;
        if (continuation is not null)
        {
            if (continuation.Length > 65536)
                throw InvalidCursor();
            try
            {
                var cursor = JsonSerializer.Deserialize<Cursor>(protector.Unprotect(continuation), Options);
                if (cursor is null || cursor.ParishId != parishId || cursor.PageSize != pageSize || cursor.QueryVersion != "people.v1")
                    throw InvalidCursor();
                token = cursor.Token;
            }
            catch (Exception ex) when (ex is CryptographicException or JsonException or FormatException)
            {
                throw InvalidCursor();
            }
        }

        var response = await documents.QueryPageAsync<Person>(C, P(parishId), StorageQuery.Type("person"), pageSize, token, ct);
        var items = response.Items.Select(row => row.Value).ToArray();
        var next = response.ContinuationToken is null ? null : protector.Protect(JsonSerializer.Serialize(new Cursor(parishId, pageSize, "people.v1", response.ContinuationToken), Options));
        return new Page<Person>
        {
            Items = items,
            ContinuationToken = next
        };
    }

    // The office edit replaces the stored record only when its version still matches; an operation id replays its first result.
    public async Task<Person> UpdateAsync(Person person, string version, Operation operation, CancellationToken ct)
    {
        var key = P(person.ParishId);
        if (await documents.ReplayAsync<Person>(C, key, operation, ct) is { } prior)
            return prior;
        return await ReplaceAsync(key, person, version, operation, "person.update", ct);
    }

    public async Task<Person> SetArchiveAsync(string parishId, string personId, string version, bool archived, Operation operation, CancellationToken ct)
    {
        var key = P(parishId);
        if (await documents.ReplayAsync<Person>(C, key, operation, ct) is { } prior)
            return prior;
        var result = (await GetAsync(parishId, personId, ct) ?? throw new DomainException("person_not_found", "The person does not exist.", FailureKind.NotFound)).Value;
        result.Archived = archived;
        return await ReplaceAsync(key, result, version, operation, "person.set_archive", ct);
    }

    private async Task<Person> ReplaceAsync(string key, Person result, string version, Operation operation, string action, CancellationToken ct)
    {
        var id = "person:" + result.Id;
        try
        {
            await documents.CommitAsync(documents.Batch(C, key).ReplaceItem(id, Row(id, key, "person", result), PartitionDocuments.Match(version)).CreateItem(Receipt(key, operation, result)).CreateItem(Audit(key, operation, action, result.Id)), ct);
            return result;
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            var replay = await documents.ReplayAsync<Person>(C, key, operation, ct);
            if (replay is not null)
                return replay;
            throw;
        }
    }

    private static DomainException InvalidCursor() => new("invalid_cursor", "The continuation token is invalid for this parish, page size or query.");
}
