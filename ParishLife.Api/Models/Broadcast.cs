// Purpose: one parish broadcast to parishioners or a ministry: drafted, independently approved, then stored in-app for the audience resolved at send time
// (now, or at a scheduled UTC time by the background processor).
// Main members: Id, ParishId, Audience, MinistryId, Title, Body, Language, optional Arabic version (TitleAr, BodyAr), TemplateId, AutomationId, Status,
// editor/approver/scheduler/sender facts, ScheduledFor, ScheduleNote, RecipientAccountIds (internal; never projected) and SkippedByPreference.

namespace ParishLife.Api.Models;

public class Broadcast
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // Members (linked parishioners) or Ministry (current members of one ministry).
    public string Audience { get; set; } = "Members";

    public string? MinistryId { get; set; } = null;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Language { get; set; } = "en";

    // Optional Arabic version stored with a non-Arabic main text; never translated or copied from it.
    public string? TitleAr { get; set; } = null;

    public string? BodyAr { get; set; } = null;

    public string? TemplateId { get; set; } = null;

    // The automation whose run created this draft, when one did.
    public string? AutomationId { get; set; } = null;

    // Draft, Approved, Scheduled, Sent or Cancelled.
    public string Status { get; set; } = "Draft";

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    // The UTC time an approved broadcast is to be stored for its audience, and who scheduled it under which capacity.
    public DateTimeOffset? ScheduledFor { get; set; } = null;

    public string? ScheduledBy { get; set; } = null;

    public string? ScheduledByAppointmentId { get; set; } = null;

    // Why a scheduled store did not happen (for example, the scheduler's access ended); the broadcast then returns to Approved.
    public string? ScheduleNote { get; set; } = null;

    public string? SentBy { get; set; } = null;

    public DateTimeOffset? SentAt { get; set; } = null;

    public string? CancelReason { get; set; } = null;

    // Each recipient's in-app copy is this stored broadcast; recipients query only their own membership in the list.
    public List<string> RecipientAccountIds { get; set; } = new();

    public int SkippedByPreference { get; set; }
}
