using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>
/// One recorded step in a reservation's approval history: who moved it from which state to which, via
/// which action, with an optional note/reason. The spec requires every transition to be recorded.
/// </summary>
public sealed class ReservationStateHistory : TenantEntity
{
    private ReservationStateHistory() { }

    public Guid ReservationId { get; private set; }
    public Guid FromStateId { get; private set; }
    public Guid ToStateId { get; private set; }
    public string ActionCode { get; private set; } = string.Empty;
    public string ActorUserId { get; private set; } = string.Empty;
    public string? Note { get; private set; }

    internal static ReservationStateHistory Record(
        Guid reservationId, Guid fromStateId, Guid toStateId,
        string actionCode, string actorUserId, string? note, Guid orgId, Guid parishId) => new()
    {
        OrgId = orgId,
        ParishId = parishId,
        ReservationId = reservationId,
        FromStateId = fromStateId,
        ToStateId = toStateId,
        ActionCode = actionCode,
        ActorUserId = actorUserId,
        Note = note
    };
}
