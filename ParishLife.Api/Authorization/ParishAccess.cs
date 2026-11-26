// Purpose: authorizes parish work using either an explicitly selected appointment or the legacy explicit grant path, without combining them.
// Main functions: RequireAsync checks current scoped duties and denials; RequireModuleAsync independently checks verified paid coverage.
// A current MFA platform operator in personal capacity (owner decision, 27 November 2026: "super admins have every permission
// everywhere") passes both checks in every verified parish without a grant or coverage. That bypass never reaches a recovery session
// (amr=recovery) or a selected appointment, and it is not clergy authority: priest-only acts still go through IClergyAuthority.

using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Authorization;

public class ParishAccess(IParishRepository repository, ICurrentActor actor, TimeProvider clock, IStaffAppointmentAccess staff, IPlatformAccess platform) : IParishAccess
{
    public async Task<Versioned<Parish>> RequireAsync(string parishId, string permission, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is { } selected)
            return await staff.RequireParishPermissionAsync(parishId, selected, permission, ct);
        var grant = await repository.GetGrantAsync(parishId, actor.AccountId, ct);
        if (grant is null || !grant.Permits(permission, clock.GetUtcNow()))
        {
            if (await OperatorParishAsync(parishId, ct) is { } verified)
                return verified;
            throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        }
        var parish = await repository.GetAsync(parishId, ct)
            ?? throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        if (parish.Value.Status is ParishStatus.Closed or ParishStatus.Suspended)
            throw new DomainException("parish_closed", "This parish is " + (parish.Value.Status == ParishStatus.Closed ? "closed" : "suspended") + " for ordinary operations.", FailureKind.Forbidden);
        return parish;
    }

    public async Task RequireModuleAsync(string parishId, string module, CancellationToken ct)
    {
        var parish = await repository.GetAsync(parishId, ct);
        if (parish?.Value.Status == ParishStatus.Verified && actor.ActingAppointmentId is null && await platform.IsOperatorAsync(ct))
            return;
        if (parish?.Value.Status != ParishStatus.Verified
            || !(await repository.GetCoveragesAsync(parishId, ct)).Any(c => c.Includes(module, clock.GetUtcNow())))
            throw new DomainException("subscription_required", "The parish requires verified active coverage for this module.", FailureKind.Forbidden);
    }

    // The operator bypass: the verified parish when the caller is a current platform operator, otherwise null.
    private async Task<Versioned<Parish>?> OperatorParishAsync(string parishId, CancellationToken ct)
    {
        if (!await platform.IsOperatorAsync(ct))
            return null;
        var parish = await repository.GetAsync(parishId, ct);
        return parish?.Value.Status == ParishStatus.Verified ? parish : null;
    }
}
