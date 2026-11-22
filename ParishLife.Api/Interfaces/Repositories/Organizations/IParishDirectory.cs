// Purpose: bounded read of registered parish roots across organization partitions for oversight and platform reporting only.
// Main functions: AllAsync returns every parish root (or fails honestly when the bounded read would be too large); callers filter and authorize.
// ByParishAsync returns one public-directory document type for every parish in one query.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Organizations;

public interface IParishDirectory
{
    Task<IReadOnlyList<Parish>> AllAsync(CancellationToken ct);

    // The public directory's location ("parishLocation") or profile ("parishProfile") document of every parish, by parish id, in one query.
    Task<IReadOnlyDictionary<string, T>> ByParishAsync<T>(string type, CancellationToken ct);
}
