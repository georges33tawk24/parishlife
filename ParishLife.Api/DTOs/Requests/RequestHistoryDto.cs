// Purpose: returns one request transition for the office, with the case as it was before the change (office projection, no token hash).
// Main members: Id, Action, FromStatus, ToStatus, ActorAccountId, At and Previous.

namespace ParishLife.Api.DTOs.Requests;

public class RequestHistoryDto
{
    public string Id { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string FromStatus { get; set; } = string.Empty;

    public string ToStatus { get; set; } = string.Empty;

    public string? ActorAccountId { get; set; } = null;

    public DateTimeOffset At { get; set; }

    public ParishRequestDto? Previous { get; set; } = null;
}
