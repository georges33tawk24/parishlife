// Purpose: reads account roots (Accounts container) and archdiocese roots (TenantControl) across partitions by their indexed document type.
// It never reads sessions, challenges, aliases or other account documents; callers must project to safe DTOs before returning anything.
// Main functions: AccountsAsync, ArchdiocesesAsync and the shared bounded paging loop AllAsync.

using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Administration;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Repositories.Administration;

internal sealed class PlatformDirectory(PartitionDocuments documents) : IPlatformDirectory
{
    // A technical bound, not a product limit: a larger platform fails with query_bound_exceeded instead of returning a silently partial list.
    internal const int Maximum = 5000;

    public Task<IReadOnlyList<Versioned<ParishUser>>> AccountsAsync(CancellationToken ct)
        => AllAsync<ParishUser>(Containers.Accounts, "account", ct);

    public Task<IReadOnlyList<Versioned<Archdiocese>>> ArchdiocesesAsync(CancellationToken ct)
        => AllAsync<Archdiocese>(Containers.TenantControl, "organization", ct);

    private async Task<IReadOnlyList<Versioned<T>>> AllAsync<T>(string container, string type, CancellationToken ct)
    {
        var rows = new List<Versioned<T>>();
        string? continuation = null;
        do
        {
            var page = await documents.QueryPageAsync<T>(container, null, StorageQuery.Type(type), 100, continuation, ct);
            rows.AddRange(page.Items);
            continuation = page.ContinuationToken;
            if (rows.Count > Maximum)
                throw new DomainException("query_bound_exceeded", "The platform list is larger than this bounded read allows.", FailureKind.Unavailable);
        }
        while (continuation is not null);
        return rows;
    }
}
