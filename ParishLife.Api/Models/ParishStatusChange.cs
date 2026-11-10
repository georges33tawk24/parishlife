// Purpose: one recorded parish suspension, reinstatement or closure, kept as history.
// Main members: Id, ParishId, Action, From, To, Reason, By and At.

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
}
