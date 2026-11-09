// Purpose: presents assigned operators with actual meeting lifecycle history, excluding private account identifiers.
// Main members: Id, MeetingId, Action, Status, RecordedAt and the restricted operator reason.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryMeetingHistoryDto
{
    public string Id { get; set; } = string.Empty;
    public string MeetingId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset RecordedAt { get; set; }
    public string? Reason { get; set; }
}
