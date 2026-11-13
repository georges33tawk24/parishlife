// Purpose: a bounded, explicit parish broadcast automation: on each due time it creates one broadcast draft from an approved template for a fixed
// audience. It never approves, schedules or sends; a different staff member still approves each draft and someone stores or schedules it.
// Main members: Id, ParishId, Name, NameAr, TemplateId, Audience, MinistryId, Recurrence, FirstRunAt, NextRunAt, Next, MaxRuns, RunCount, Status, StatusReason,
// last-run facts (LastRunAt, LastOutcome, LastDraftId) and the responsible staff account and capacity (UpdatedBy, UpdatedByAppointmentId).

namespace ParishLife.Api.Models;

public class BroadcastAutomation
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public string TemplateId { get; set; } = string.Empty;

    // Members or Ministry, as for a broadcast.
    public string Audience { get; set; } = "Members";

    public string? MinistryId { get; set; } = null;

    // Weekly or Monthly.
    public string Recurrence { get; set; } = "Weekly";

    // The first due time; later due times are whole weeks or calendar months after it (UTC).
    public DateTimeOffset FirstRunAt { get; set; }

    public DateTimeOffset NextRunAt { get; set; }

    // The automation ends after this many due times; it never runs unbounded.
    public int MaxRuns { get; set; } = 1;

    public int RunCount { get; set; }

    // Active, Paused or Ended.
    public string Status { get; set; } = "Active";

    public string? StatusReason { get; set; } = null;

    public DateTimeOffset? LastRunAt { get; set; } = null;

    // Drafted, or Skipped when the previous draft was still waiting to be sent or cancelled.
    public string? LastOutcome { get; set; } = null;

    public string? LastDraftId { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    // The staff account responsible for the drafts; its communications access is checked again at every run.
    public string UpdatedBy { get; set; } = string.Empty;

    public string? UpdatedByAppointmentId { get; set; } = null;

    public DateTimeOffset UpdatedAt { get; set; }

    // The first due time strictly after the given instant; missed due times are skipped, never backfilled.
    public DateTimeOffset Next(DateTimeOffset after)
    {
        for (var step = 0; step < 10000; step++)
        {
            var due = Recurrence == "Monthly" ? FirstRunAt.AddMonths(step) : FirstRunAt.AddDays(7 * step);
            if (due > after) return due;
        }
        throw new InvalidOperationException("No later due time within the supported range.");
    }
}
