// Purpose: reads parish root documents across TenantControl partitions by their indexed document type, for bishop oversight and platform
// insights. It never returns grants, people or case documents; services authorize and filter the result.
// Main functions: AllAsync; ByParishAsync reads one reviewed public-directory document type (location, profile) of every parish in one
// query instead of one read per parish.

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

    // Only what the public directory projects; anything else stays readable per parish only, after that parish's checks.
    private static readonly string[] DirectoryTypes = ["parishLocation", "parishProfile"];

    public async Task<IReadOnlyDictionary<string, T>> ByParishAsync<T>(string type, CancellationToken ct)
    {
        if (!DirectoryTypes.Contains(type, StringComparer.Ordinal))
            throw new InvalidOperationException("Only the public directory's location and profile documents are read across parishes.");
        var result = new Dictionary<string, T>(StringComparer.Ordinal);
        // Keyed by the partition that holds each document, never by the parish id written inside it.
        foreach (var row in await documents.QueryDocumentsAsync<T>(Containers.TenantControl, null, StorageQuery.Type(type), ct, Maximum))
            if (row.PartitionKey.StartsWith("parish:", StringComparison.Ordinal))
                result[row.PartitionKey["parish:".Length..]] = row.Data;
        return result;
    }
}
