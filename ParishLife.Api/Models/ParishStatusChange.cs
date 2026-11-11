// Purpose: one recorded parish suspension, reinstatement or closure, kept as history.
// Main members: Id, ParishId, Action, From, To, Reason, By, At and the owner notice's work pointer.

using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Models;

public class ParishStatusChange
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public ParishStatus From { get; set; }

    public ParishStatus To { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    // Internal source linkage only; null on changes recorded before notice outcomes were tracked.
    public List<string>? NotificationWorkIds { get; set; } = null;
}
