// Purpose: reads parish root documents across TenantControl partitions by their indexed document type, for bishop oversight and platform
// insights. It never returns grants, people or case documents; services authorize and filter the result.
// Main function: AllAsync.

using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;

namespace ParishLife.Api.Repositories.Organizations;

internal sealed class ParishDirectory(PartitionDocuments documents) : IParishDirectory
{
    // A technical bound, not a product limit: a larger platform fails with query_bound_exceeded instead of returning a silently partial list.
    internal const int Maximum = 2000;

    // ponytail: filters jurisdiction in memory because /data/jurisdictionArchdioceseId is not in the TenantControl index policy; add that path
    // through the separately authorized index update before parish counts reach the bound.
    public Task<IReadOnlyList<Parish>> AllAsync(CancellationToken ct)
        => documents.QueryAsync<Parish>(Containers.TenantControl, null, StorageQuery.Type("parish"), ct, Maximum);
}
