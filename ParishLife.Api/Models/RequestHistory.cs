// Purpose: represents one append-only request transition with the request state before it.
// Main members: Id, RequestId, Action, FromStatus, ToStatus, ActorAccountId, At and Previous.

namespace ParishLife.Api.Models;

public class RequestHistory
{
    public string Id { get; set; } = string.Empty;

    public string RequestId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string FromStatus { get; set; } = string.Empty;

    public string ToStatus { get; set; } = string.Empty;

    public string? ActorAccountId { get; set; } = null;

    public DateTimeOffset At { get; set; }

    public ParishRequest? Previous { get; set; } = null;
}
