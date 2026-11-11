// Purpose: one parish broadcast to parishioners or a ministry: drafted, independently approved, then stored in-app for the audience resolved at send time.
// Main members: Id, ParishId, Audience, MinistryId, Title, Body, Language, TemplateId, Status, editor/approver/sender facts,
// RecipientAccountIds (internal; never projected) and SkippedByPreference.

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

    public string? TemplateId { get; set; } = null;

    // Draft, Approved, Sent or Cancelled.
    public string Status { get; set; } = "Draft";

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    public string? SentBy { get; set; } = null;

    public DateTimeOffset? SentAt { get; set; } = null;

    public string? CancelReason { get; set; } = null;

    // Each recipient's in-app copy is this stored broadcast; recipients query only their own membership in the list.
    public List<string> RecipientAccountIds { get; set; } = new();

    public int SkippedByPreference { get; set; }
}
