// Purpose: bounded read of registered parish roots across organization partitions for oversight and platform reporting only.
// Main function: AllAsync returns every parish root (or fails honestly when the bounded read would be too large); callers filter and authorize.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Organizations;

public interface IParishDirectory
{
    Task<IReadOnlyList<Parish>> AllAsync(CancellationToken ct);
}
