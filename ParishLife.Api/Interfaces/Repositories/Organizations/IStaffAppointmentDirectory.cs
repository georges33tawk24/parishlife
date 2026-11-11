// Purpose: bounds personal staff-invitation discovery to the authenticated account across existing organization partitions.
// Main functions: ForAccountAsync returns one protected-cursor page without exposing arbitrary cross-partition queries; BishopAppointmentsForAccountAsync
// returns the account's own bishop appointment records (bounded) so callers can verify them against each archdiocese seat.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Organizations;

public interface IStaffAppointmentDirectory
{
    Task<Page<Versioned<StaffAppointment>>> ForAccountAsync(string accountId, int size, string? cursor, CancellationToken ct);

    Task<IReadOnlyList<BishopAppointment>> BishopAppointmentsForAccountAsync(string accountId, CancellationToken ct);
}
