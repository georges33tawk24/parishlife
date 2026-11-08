// Purpose: Declares the IParishAccess boundary used by backend services without exposing provider implementation
// details.
// Main functions: RequireAsync, RequireModuleAsync.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Services.Organizations;

public interface IParishAccess
{
    Task<Versioned<Parish>> RequireAsync(string parishId, string permission, CancellationToken ct);
    Task RequireModuleAsync(string parishId, string module, CancellationToken ct);
}
