// Purpose: Declares the IPlatformAccess boundary used by backend services without exposing provider implementation
// details.
// Main functions: RequireOperatorAsync (throws unless the caller is a current MFA platform operator in personal capacity) and
// IsOperatorAsync (the same rule as a yes/no answer, used by the operator's "every parish permission" bypass).

namespace ParishLife.Api.Interfaces.Services.Common;

public interface IPlatformAccess
{
    Task RequireOperatorAsync(CancellationToken ct);

    Task<bool> IsOperatorAsync(CancellationToken ct);
}
