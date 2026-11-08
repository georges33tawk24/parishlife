// Purpose: Declares the IResourceAllocator boundary used by backend services without exposing provider
// implementation details.
// Main functions: HoldAsync, ConfirmAsync, ReleaseAsync, BusyAsync.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Scheduling;

public interface IResourceAllocator
{
    Task HoldAsync(AllocationRequest request, string operationId, DateTimeOffset expiresAt, CancellationToken ct);
    Task ConfirmAsync(string resourceId, string operationId, CancellationToken ct);
    Task ReleaseAsync(string resourceId, string operationId, CancellationToken ct);
    Task<IReadOnlyList<ResourceAllocation>> BusyAsync(string resourceId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct);
}
