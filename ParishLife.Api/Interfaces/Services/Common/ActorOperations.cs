// Purpose: binds ordinary actor-owned commands and audit to the explicitly selected appointment without changing legacy fingerprints.
// Main function: CreateOperation forwards the authenticated identity and optional acting appointment; callers still enforce permission before replay.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Services.Common;

public static class ActorOperations
{
    public static Operation CreateOperation(this ICurrentActor actor, Guid id, object request, TimeProvider clock, string? scope = null)
        => Operation.Create(id, actor.AccountId, request, clock, scope, actor.ActingAppointmentId);
}
