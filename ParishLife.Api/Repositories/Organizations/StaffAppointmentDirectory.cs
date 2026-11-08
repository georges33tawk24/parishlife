// Purpose: queries only one account's staff invitations in TenantControl with account-bound protected continuation tokens.
// Main function: ForAccountAsync validates page size/cursor and uses a parameterized account filter; BadCursor rejects altered contexts.

using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;

namespace ParishLife.Api.Repositories.Organizations;

internal sealed class StaffAppointmentDirectory(PartitionDocuments documents, IDataProtectionProvider protection) : IStaffAppointmentDirectory
{
    private readonly IDataProtector protector = protection.CreateProtector("ParishLife.StaffDirectoryCursor.v1");
    private sealed record Cursor(string AccountId, int Size, string Token);

    public async Task<Page<Versioned<StaffAppointment>>> ForAccountAsync(string accountId, int size, string? cursor, CancellationToken ct)
    {
        if (size is < 1 or > 100)
            throw new DomainException("invalid_page", "Use 1–100 rows.");
        string? raw = null;
        if (cursor is not null)
        {
            if (cursor.Length > 65536)
                throw BadCursor();
            try
            {
                var value = JsonSerializer.Deserialize<Cursor>(protector.Unprotect(cursor), JsonDefaults.Options);
                if (value is null || value.AccountId != accountId || value.Size != size)
                    throw BadCursor();
                raw = value.Token;
            }
            catch (Exception error) when (error is CryptographicException or JsonException or FormatException) { throw BadCursor(); }
        }
        var page = await documents.QueryPageAsync<StaffAppointment>(Containers.TenantControl, null,
            StorageQuery.Type("staffAppointment").Where(StorageFilter.Eq("data.accountId", accountId)), size, raw, ct);
        return new Page<Versioned<StaffAppointment>>
        {
            Items = page.Items,
            ContinuationToken = page.ContinuationToken is null ? null : protector.Protect(JsonSerializer.Serialize(
                new Cursor(accountId, size, page.ContinuationToken), JsonDefaults.Options))
        };
    }

    private static DomainException BadCursor() => new("invalid_cursor", "The continuation token does not belong to this account and page size.");
}
