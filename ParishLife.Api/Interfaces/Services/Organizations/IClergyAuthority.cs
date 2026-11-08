// Purpose: Declares the IClergyAuthority boundary used by backend services without exposing provider
// implementation details.
// Main functions: RequireAsync.

namespace ParishLife.Api.Interfaces.Services.Organizations;

public interface IClergyAuthority
{
    Task RequireAsync(string parishId, string accountId, string role, CancellationToken cancellationToken);
}
