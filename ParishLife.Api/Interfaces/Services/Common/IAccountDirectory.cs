// Purpose: Declares the IAccountDirectory boundary used by backend services without exposing provider
// implementation details.
// Main functions: IsActiveVerifiedAsync.

namespace ParishLife.Api.Interfaces.Services.Common;

public interface IAccountDirectory
{
    Task<bool> IsActiveVerifiedAsync(string accountId, CancellationToken ct);
}
