// Purpose: presents the permitted application timeline without internal identity and eligibility evidence.
// Main members: action, previous/resulting stage, actual time and applicant-visible reason.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryApplicationHistoryDto
{
    public string Id { get; set; } = string.Empty;
    public string ApplicationId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? PreviousStatus { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset RecordedAt { get; set; }
    public string? Reason { get; set; }
}
