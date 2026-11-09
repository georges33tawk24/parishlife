// Purpose: exposes meeting details to the current assigned operator or an eligible current member of the future group audience.
// Main members: exact occurrence identity/dates, group content, lifecycle and RSVP state; policy evidence is operator-only.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryMeetingDto
{
    public string Id { get; set; } = string.Empty;
    public string MinistryId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string TimeZone { get; set; } = string.Empty;
    public string Visibility { get; set; } = "Ministry";
    public string? LocationDescription { get; set; }
    public string Agenda { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string RsvpMode { get; set; } = string.Empty;
    public DateTimeOffset? RsvpDeadline { get; set; }
    public string? RsvpPolicyReference { get; set; }
    public bool RsvpOpen { get; set; }
}
