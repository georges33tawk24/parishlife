// Purpose: shows a broadcast to communications staff with counts and per-channel state, never the recipient list.
// Main members: Id, Audience, MinistryId, Title, Body, Language, TitleAr, BodyAr, TemplateId, AutomationId, Status, editor/approver/scheduler/sender
// facts, ScheduledFor, ScheduleNote, CancelReason, RecipientCount, SkippedByPreferenceCount and Channels.

namespace ParishLife.Api.DTOs.Communications;

public class BroadcastDto
{
    public string Id { get; set; } = string.Empty;

    public string Audience { get; set; } = "Members";

    public string? MinistryId { get; set; } = null;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Language { get; set; } = "en";

    public string? TitleAr { get; set; } = null;

    public string? BodyAr { get; set; } = null;

    public string? TemplateId { get; set; } = null;

    public string? AutomationId { get; set; } = null;

    public string Status { get; set; } = "Draft";

    public string UpdatedBy { get; set; } = string.Empty;

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    public DateTimeOffset? ScheduledFor { get; set; } = null;

    public string? ScheduledBy { get; set; } = null;

    public string? ScheduleNote { get; set; } = null;

    public string? SentBy { get; set; } = null;

    public DateTimeOffset? SentAt { get; set; } = null;

    public string? CancelReason { get; set; } = null;

    public int RecipientCount { get; set; }

    public int SkippedByPreferenceCount { get; set; }

    public BroadcastChannelDto[] Channels { get; set; } = Array.Empty<BroadcastChannelDto>();
}
