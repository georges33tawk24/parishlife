// Purpose: keeps legacy grant-boundary unit scenarios isolated from the new staff implementation, which is exercised by real integration tests.
// Main functions: RequireParishPermissionAsync and RequirePriestAsync reject selected staff capacity; these legacy scenarios never select an appointment.

using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Tests.Support;

public class LegacyOnlyStaffAccess : IStaffAppointmentAccess
{
    public Task<Versioned<Parish>> RequireParishPermissionAsync(string parishId, string appointmentId, string permission, CancellationToken ct)
        => throw new DomainException("resource_not_found", "No selected staff fixture exists.", FailureKind.NotFound);

    public Task RequirePriestAsync(string parishId, string accountId, CancellationToken ct)
        => throw new DomainException("clergy_authority_required", "No clergy fixture exists.", FailureKind.Forbidden);
}
