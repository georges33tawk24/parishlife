// Purpose: stores a ministry-owned meeting and its exact linked calendar occurrence, group audience and RSVP policy.
// Main members: source identity, Title/TitleAr, dates, draft/confirmation/cancellation state, agenda, location and actual RSVP cutoff;
// ExpectedPersonIds remains empty until a separate attendance workflow records an evidenced occurrence-date snapshot.

namespace ParishLife.Api.Models;

public class MinistryMeeting
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    // Optional Arabic twin of Title; kept on the ministry meeting only (the linked calendar occurrence keeps Title).
    public string? TitleAr { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string TimeZone { get; set; } = string.Empty;

    public string Visibility { get; set; } = "Ministry";

    public string? LocationDescription { get; set; }

    public string Agenda { get; set; } = string.Empty;

    public string[] MaterialIds { get; set; } = Array.Empty<string>();

    public string Status { get; set; } = string.Empty;

    public string[] ExpectedPersonIds { get; set; } = Array.Empty<string>();

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ConfirmedAt { get; set; }

    public DateTimeOffset? CancelledAt { get; set; }

    public string RsvpMode { get; set; } = "Optional";

    public DateTimeOffset? RsvpDeadline { get; set; } = null;

    public string? RsvpPolicyReference { get; set; }
}
