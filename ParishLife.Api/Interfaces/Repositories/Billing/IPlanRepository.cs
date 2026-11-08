// Purpose: Declares the IPlanRepository boundary used by backend services without exposing provider implementation
// details.
// Main functions: GetAsync, ListAsync, PublishAsync.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Billing;

public interface IPlanRepository
{
    Task<PlanDefinition?> GetAsync(string id, CancellationToken ct);
    Task<IReadOnlyList<PlanDefinition>> ListAsync(CancellationToken ct);
    Task<PlanDefinition> PublishAsync(PlanDefinition plan, Operation operation, CancellationToken ct);
}
