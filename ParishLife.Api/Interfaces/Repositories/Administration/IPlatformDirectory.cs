// Purpose: bounded platform-wide reads of sign-in accounts and archdiocese roots for operator lists; services authorize and project the result.
// Main functions: AccountsAsync and ArchdiocesesAsync return every stored root with its version, or fail honestly past the technical bound.

using ParishLife.Api.Identity;
using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Administration;

public interface IPlatformDirectory
{
    Task<IReadOnlyList<Versioned<ParishUser>>> AccountsAsync(CancellationToken ct);

    Task<IReadOnlyList<Versioned<Archdiocese>>> ArchdiocesesAsync(CancellationToken ct);
}
