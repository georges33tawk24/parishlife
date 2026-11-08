// Purpose: enforces a selected staff appointment without combining its duties with unrelated grants or roles.
// Main functions: RequireParishPermissionAsync validates selected operational duties; RequirePriestAsync validates actual accepted clergy office.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Services.Organizations;

public interface IStaffAppointmentAccess
{
    Task<Versioned<Parish>> RequireParishPermissionAsync(string parishId, string appointmentId, string permission, CancellationToken ct);
    Task RequirePriestAsync(string parishId, string accountId, CancellationToken ct);
}
