// Purpose: Declares the IPlatformAccess boundary used by backend services without exposing provider implementation
// details.
// Main functions: RequireOperatorAsync.

namespace ParishLife.Api.Interfaces.Services.Common;

public interface IPlatformAccess
{
    Task RequireOperatorAsync(CancellationToken ct);
}
