// Purpose: shows a broadcast automation to communications staff: what it drafts, for whom, when it next runs and how its last run ended.
// Main members: Id, Name, NameAr, TemplateId, Audience, MinistryId, Recurrence, NextRunAt, MaxRuns, RunCount, Status, StatusReason, LastRunAt,
// LastOutcome, LastDraftId, CreatedBy, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.DTOs.Communications;

public class BroadcastAutomationDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public string TemplateId { get; set; } = string.Empty;

    public string Audience { get; set; } = "Members";

    public string? MinistryId { get; set; } = null;

    public string Recurrence { get; set; } = "Weekly";

    public DateTimeOffset NextRunAt { get; set; }

    public int MaxRuns { get; set; }

    public int RunCount { get; set; }

    public string Status { get; set; } = "Active";

    public string? StatusReason { get; set; } = null;

    public DateTimeOffset? LastRunAt { get; set; } = null;

    public string? LastOutcome { get; set; } = null;

    public string? LastDraftId { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
