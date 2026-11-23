// Purpose: Declares the IAccountDirectory boundary used by backend services without exposing provider
// implementation details.
// Main functions: IsActiveVerifiedAsync.

namespace ParishLife.Api.Interfaces.Services.Common;

public interface IAccountDirectory
{
    Task<bool> IsActiveVerifiedAsync(string accountId, CancellationToken ct);

    // The account named by username or email, or null; callers still check that it is active and verified.
    Task<string?> FindIdAsync(string usernameOrEmail, CancellationToken ct) => Task.FromResult<string?>(null);
}
