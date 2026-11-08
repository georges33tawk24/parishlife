// Purpose: fails closed unless a verified account has the exact current parish/clergy appointment.
// Main function: RequireAsync checks stored authority and explicit denials; never trusts caller role claims.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Authorization;

internal sealed class ClergyAuthority(IRecordTransactions records, IParishRepository parishes, IStaffAppointmentAccess staff,
    ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock) : IClergyAuthority
{
    public async Task RequireAsync(string parishId, string accountId, string role, CancellationToken cancellationToken)
    {
        if (role == "Priest")
        {
            try
            { await staff.RequirePriestAsync(parishId, accountId, cancellationToken); return; }
            catch (DomainException error) when (error.Kind is FailureKind.Forbidden or FailureKind.NotFound) { throw Missing(); }
        }
        if (role != "Bishop" || !await proof.IsVerifiedMfaAccountAsync(accountId, cancellationToken))
            throw Missing();
        var grant = await parishes.GetGrantAsync(parishId, accountId, cancellationToken);
        if (grant?.Denies.Contains(Permissions.ClergyApprove, StringComparer.Ordinal) == true)
            throw Missing();
        var parish = await parishes.GetAsync(parishId, cancellationToken);
        if (parish?.Value.JurisdictionArchdioceseId is not { } arch
            || (await parishes.GetArchdioceseAsync(arch, cancellationToken))?.Value.Verified != true)
            throw Missing();
        var scope = new RecordScope { Area = RecordArea.Archdiocese, OwnerId = arch };
        var seat = await records.ReadAsync<BishopSeat>(scope, "bishopSeat", cancellationToken);
        var appointment = seat is null ? null : await records.ReadAsync<BishopAppointment>(scope, "bishopAppointment:" + seat.Value.AppointmentId, cancellationToken);
        if (appointment is null || appointment.Value.AccountId != accountId || appointment.Value.ArchdioceseId != arch
            || !appointment.Value.IsEffective(clock.GetUtcNow()))
            throw Missing();
        if (accountId == actor.AccountId)
        {
            await proof.RequireMfaAsync(cancellationToken);
            if (actor.ActingAppointmentId != appointment.Value.Id)
                throw Missing();
        }
    }

    private static DomainException Missing() => new("clergy_authority_required", "A current evidenced clergy appointment is required for this action.", FailureKind.Forbidden);
}
