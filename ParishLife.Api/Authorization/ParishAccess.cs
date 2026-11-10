// Purpose: authorizes parish work using either an explicitly selected appointment or the legacy explicit grant path, without combining them.
// Main functions: RequireAsync checks current scoped duties and denials; RequireModuleAsync independently checks verified paid coverage.

using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Authorization;

public class ParishAccess(IParishRepository repository, ICurrentActor actor, TimeProvider clock, IStaffAppointmentAccess staff) : IParishAccess
{
    public async Task<Versioned<Parish>> RequireAsync(string parishId, string permission, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is { } selected)
            return await staff.RequireParishPermissionAsync(parishId, selected, permission, ct);
        var grant = await repository.GetGrantAsync(parishId, actor.AccountId, ct);
        if (grant is null || !grant.Permits(permission, clock.GetUtcNow()))
            throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        var parish = await repository.GetAsync(parishId, ct)
            ?? throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        if (parish.Value.Status is ParishStatus.Closed or ParishStatus.Suspended)
            throw new DomainException("parish_closed", "This parish is " + (parish.Value.Status == ParishStatus.Closed ? "closed" : "suspended") + " for ordinary operations.", FailureKind.Forbidden);
        return parish;
    }

    public async Task RequireModuleAsync(string parishId, string module, CancellationToken ct)
    {
        var parish = await repository.GetAsync(parishId, ct);
        if (parish?.Value.Status != ParishStatus.Verified
            || !(await repository.GetCoveragesAsync(parishId, ct)).Any(c => c.Includes(module, clock.GetUtcNow())))
            throw new DomainException("subscription_required", "The parish requires verified active coverage for this module.", FailureKind.Forbidden);
    }
}
