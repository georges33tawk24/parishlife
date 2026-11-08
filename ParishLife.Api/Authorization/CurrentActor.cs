// Purpose: Derives the current account ID from the authenticated principal instead of accepting an actor from
// request data.
// Main members: AccountId derives identity; ActingAppointmentId validates the explicitly selected appointment header.

using System.Security.Claims;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Authorization;

internal sealed class CurrentActor(IHttpContextAccessor context) : ICurrentActor
{
    public string AccountId => context.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new DomainException("authentication_required", "Authentication is required.", FailureKind.Forbidden);

    public string? ActingAppointmentId
    {
        get
        {
            var values = context.HttpContext?.Request.Headers["X-ParishLife-Appointment"];
            if (values is null || values.Value.Count == 0)
                return null;
            if (values.Value.Count != 1 || !Guid.TryParse(values.Value[0], out var id) || id == Guid.Empty)
                throw new DomainException("invalid_acting_appointment", "Select one valid appointment for this request.");
            return id.ToString("N");
        }
    }
}
