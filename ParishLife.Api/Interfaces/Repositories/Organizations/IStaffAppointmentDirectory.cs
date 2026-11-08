// Purpose: bounds personal staff-invitation discovery to the authenticated account across existing organization partitions.
// Main function: ForAccountAsync returns one protected-cursor page without exposing arbitrary cross-partition queries.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Organizations;

public interface IStaffAppointmentDirectory
{
    Task<Page<Versioned<StaffAppointment>>> ForAccountAsync(string accountId, int size, string? cursor, CancellationToken ct);
}
