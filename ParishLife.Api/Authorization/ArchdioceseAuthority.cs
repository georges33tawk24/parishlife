// Purpose: resolves the current actor's evidenced bishop authority from the authoritative archdiocese partition.
// Main functions: RequireBishopAsync and RequireBishopAppointmentAsync check current identity, lockout, MFA, exact scope and accepted office.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Authorization;

internal class ArchdioceseAuthority(IRecordTransactions records, IParishRepository organizations,
    MfaAccountAccess proof, ICurrentActor actor, TimeProvider clock) : IArchdioceseAuthority
{
    public async Task RequireBishopAsync(string archdioceseId, CancellationToken ct)
        => _ = await RequireBishopAppointmentAsync(archdioceseId, ct);

    public async Task<Versioned<BishopAppointment>> RequireBishopAppointmentAsync(string archdioceseId, CancellationToken ct)
    {
        try
        { await proof.RequireMfaAsync(ct); }
        catch (DomainException error) when (error.Kind == FailureKind.Forbidden) { throw Missing(); }
        if ((await organizations.GetArchdioceseAsync(archdioceseId, ct))?.Value.Verified != true)
            throw Missing();
        var scope = new RecordScope { Area = RecordArea.Archdiocese, OwnerId = archdioceseId };
        var seat = await records.ReadAsync<BishopSeat>(scope, "bishopSeat", ct);
        var appointment = seat is null ? null : await records.ReadAsync<BishopAppointment>(scope, "bishopAppointment:" + seat.Value.AppointmentId, ct);
        if (appointment is null || appointment.Value.ArchdioceseId != archdioceseId
            || appointment.Value.AccountId != actor.AccountId || !appointment.Value.IsEffective(clock.GetUtcNow()))
            throw Missing();
        if (actor.ActingAppointmentId is { } selected && selected != appointment.Value.Id)
            throw Missing();
        return appointment;
    }

    private static DomainException Missing() => new("bishop_authority_required", "A current accepted bishop appointment and MFA are required in this archdiocese.", FailureKind.Forbidden);
}
