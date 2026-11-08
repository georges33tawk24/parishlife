// Purpose: derives priest and administrative access from accepted appointments, actual jurisdiction, current identity and selected capacity.
// Main functions: RequireParishPermissionAsync, RequirePriestAsync, RequireOwnAsync, RequireReaderAsync; explicit denials survive role switching.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Authorization;

public class StaffAppointmentAccess(IRecordTransactions records, IParishRepository parishes, ICurrentActor actor,
    MfaAccountAccess proof, IArchdioceseAuthority bishops, TimeProvider clock) : IStaffAppointmentAccess
{
    public static RecordScope Scope(string archdioceseId, string? parishId) => new()
    {
        Area = parishId is null ? RecordArea.Archdiocese : RecordArea.Parish,
        OwnerId = parishId ?? archdioceseId
    };

    public static string Key(string id) => "staffAppointment:" + id;

    public async Task<Versioned<Parish>> RequireParishPermissionAsync(string parishId, string appointmentId, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
        var row = await RequireOwnAsync(parish.Value.JurisdictionArchdioceseId ?? "", parishId, appointmentId, ct);
        var grant = await parishes.GetGrantAsync(parishId, actor.AccountId, ct);
        if (!row.Value.Permits(permission, clock.GetUtcNow()) || grant?.Denies.Contains(permission, StringComparer.Ordinal) == true)
            throw Missing();
        if (parish.Value.Status == ParishStatus.Closed)
            throw new DomainException("parish_closed", "This parish is closed for ordinary operations.", FailureKind.Forbidden);
        return parish;
    }

    public async Task<Versioned<StaffAppointment>> RequireOwnAsync(string archdioceseId, string? parishId, string id, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var row = await records.ReadAsync<StaffAppointment>(Scope(archdioceseId, parishId), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.AccountId != actor.AccountId || row.Value.ArchdioceseId != archdioceseId
            || row.Value.ParishId != parishId || !row.Value.IsEffective(clock.GetUtcNow())
            || actor.ActingAppointmentId is { } selected && selected != id)
            throw Missing();
        await CurrentScopeAsync(row.Value, ct);
        return row;
    }

    public async Task RequirePriestAsync(string parishId, string accountId, CancellationToken ct)
    {
        if (!await proof.IsVerifiedMfaAccountAsync(accountId, ct))
            throw Missing();
        var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
        if (parish.Value.JurisdictionArchdioceseId is not { } jurisdiction
            || (await parishes.GetArchdioceseAsync(jurisdiction, ct))?.Value.Verified != true)
            throw Missing();
        var grant = await parishes.GetGrantAsync(parishId, accountId, ct);
        if (grant?.Denies.Contains(Permissions.ClergyApprove, StringComparer.Ordinal) == true)
            throw Missing();
        IEnumerable<Versioned<StaffAppointment>> rows;
        if (actor.AccountId == accountId)
        {
            var id = actor.ActingAppointmentId ?? throw Missing();
            rows = [await RequireOwnAsync(parish.Value.JurisdictionArchdioceseId ?? "", parishId, id, ct)];
        }
        else
        {
            rows = await records.CollectAsync<StaffAppointment>(Scope("", parishId), "staffAppointment", ct, 5000,
                new RecordCondition { Path = "accountId", Comparison = "eq", Value = accountId });
        }
        if (!rows.Any(row => row.Value.Role == StaffAppointmentRole.Priest && row.Value.ParishId == parishId
            && row.Value.ArchdioceseId == parish.Value.JurisdictionArchdioceseId && row.Value.IsEffective(clock.GetUtcNow())
            && !row.Value.Denies.Contains(Permissions.ClergyApprove, StringComparer.Ordinal)))
            throw Missing();
    }

    public async Task<bool> RequireReaderAsync(string archdioceseId, string? parishId, CancellationToken ct)
    {
        try
        { await bishops.RequireBishopAsync(archdioceseId, ct); return true; }
        catch (DomainException error) when (error.Kind == FailureKind.Forbidden) { }
        if (parishId is not null || actor.ActingAppointmentId is not { } id)
            throw Missing();
        var row = await RequireOwnAsync(archdioceseId, null, id, ct);
        if (row.Value.Role != StaffAppointmentRole.ArchdioceseAdmin || !row.Value.Permits("archdiocese.appointments.read", clock.GetUtcNow()))
            throw Missing();
        return false;
    }

    private async Task CurrentScopeAsync(StaffAppointment value, CancellationToken ct)
    {
        if ((await parishes.GetArchdioceseAsync(value.ArchdioceseId, ct))?.Value.Verified != true)
            throw Missing();
        if (value.Role == StaffAppointmentRole.ArchdioceseAdmin)
        {
            if (value.ParishId is not null)
                throw Missing();
        }
        else if (value.Role != StaffAppointmentRole.Priest || value.ParishId is null
            || (await parishes.GetAsync(value.ParishId, ct))?.Value.JurisdictionArchdioceseId != value.ArchdioceseId)
            throw Missing();
    }

    private static DomainException Missing() => new("resource_not_found", "The requested appointment or duty is unavailable in this scope.", FailureKind.NotFound);
}
