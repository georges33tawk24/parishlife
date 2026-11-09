// Purpose: validates a source-owned meeting draft and the actual group RSVP rules without accepting an arbitrary calendar source.
// Main members: OperationId, Version, title/dates/time zone, optional agenda/location and explicit RSVP policy/cutoff.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SaveMinistryMeetingDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; }

    [Required, StringLength(500)]
    public string Title { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }

    [Required, StringLength(100)]
    public string TimeZone { get; set; } = string.Empty;

    [StringLength(10000)]
    public string? Agenda { get; set; }

    [StringLength(1000)]
    public string? LocationDescription { get; set; }

    [Required, StringLength(20)]
    public string RsvpMode { get; set; } = "Optional";

    public DateTimeOffset? RsvpDeadline { get; set; }

    [StringLength(1000)]
    public string? RsvpPolicyReference { get; set; }
}
