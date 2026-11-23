// Purpose: who may register a church and hand its control to a priest (owner decision, 23 November 2026): a ParishLife platform operator
// (super admin), the current bishop of the archdiocese, or one of his current archdiocese administrators acting in that appointment.
// Nobody else may register a church.
// Main function: RequireAsync(archdioceseId) throws church_authority_required unless the actor holds one of those offices; without an
// archdiocese only an operator qualifies.

using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Authorization;

public class ChurchAdministrationAuthority(IPlatformAccess platform, IArchdioceseAuthority bishops, IStaffAppointmentAccess staff,
    IParishRepository parishes, ICurrentActor actor)
{
    private static DomainException Refused() => new("church_authority_required",
        "Only ParishLife administrators, the bishop or his archdiocese administrators may do this.", FailureKind.Forbidden);

    public async Task RequireAsync(string? archdioceseId, CancellationToken ct)
    {
        if (archdioceseId is not null && (await parishes.GetArchdioceseAsync(archdioceseId, ct))?.Value.Verified != true)
            throw new DomainException("organization_unavailable", "Select a verified registered archdiocese.");
        if (actor.ActingAppointmentId is null)
        {
            try { await platform.RequireOperatorAsync(ct); return; }
            catch (DomainException e) when (e.Kind is FailureKind.Forbidden or FailureKind.NotFound) { /* not an operator */ }
        }
        if (archdioceseId is null)
            throw Refused();
        if (actor.ActingAppointmentId is not null)
        {
            if (await staff.IsArchdioceseAdminAsync(archdioceseId, ct))
                return;
            throw Refused();
        }
        try { await bishops.RequireBishopAsync(archdioceseId, ct); }
        catch (DomainException e) when (e.Kind is FailureKind.Forbidden or FailureKind.NotFound) { throw Refused(); }
    }
}
