// Purpose: rechecks the durable initiator's current account, exact selected appointment/grant, denials and coverage without impersonating a browser user.
// Main functions: CaptureStampAsync records the authorizing security version; RequireAsync rejects withdrawn, expired, reset or wrong-scope authority before allocations proceed.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Scheduling;

public class ReservationWorkAuthorization(IRecordTransactions records, IParishRepository parishes, IUserStore<ParishUser> users,
    IAccountDirectory accounts, MfaAccountAccess proof, TimeProvider clock)
{
    internal async Task<string> CaptureStampAsync(string account, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(account, ct);
        return user?.SecurityStamp ?? throw Changed();
    }
    internal async Task<Versioned<Parish>> RequireAsync(ReservationWork work, CancellationToken ct)
    {
        var root = await parishes.GetAsync(work.ParishId, ct);
        var user = await users.FindByIdAsync(work.ActorId, ct);
        if (root?.Value.Status != ParishStatus.Verified || user is null || string.IsNullOrEmpty(work.ActorSecurityStamp)
            || user.SecurityStamp != work.ActorSecurityStamp || !await accounts.IsActiveVerifiedAsync(work.ActorId, ct))
            throw Changed();
        var grant = await parishes.GetGrantAsync(work.ParishId, work.ActorId, ct);
        if (work.ActingAppointmentId is { } selected)
        {
            var row = await records.ReadAsync<StaffAppointment>(SchedulingScope.For(work.ParishId), "staffAppointment:" + selected, ct);
            if (row is null || row.Value.AccountId != work.ActorId || row.Value.ParishId != work.ParishId || row.Value.Role != StaffAppointmentRole.Priest
                || row.Value.ArchdioceseId != root.Value.JurisdictionArchdioceseId || !row.Value.Permits(Permissions.FacilitiesManage, clock.GetUtcNow())
                || !await proof.IsVerifiedMfaAccountAsync(work.ActorId, ct) || grant?.Denies.Contains(Permissions.FacilitiesManage, StringComparer.Ordinal) == true
                || (await parishes.GetArchdioceseAsync(row.Value.ArchdioceseId, ct))?.Value.Verified != true)
                throw Changed();
        }
        else if (grant?.Permits(Permissions.FacilitiesManage, clock.GetUtcNow()) != true)
            throw Changed();
        if (!(await parishes.GetCoveragesAsync(work.ParishId, ct)).Any(value => value.Includes("facilities", clock.GetUtcNow())))
            throw Changed();
        return root;
    }
    private static DomainException Changed() => new("authorization_changed", "The recorded reservation authority or coverage is no longer current.", FailureKind.Conflict);
}
