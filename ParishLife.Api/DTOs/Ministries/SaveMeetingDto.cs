// Purpose: represents save meeting input/output data.
// Main members: OperationId, EventId, Agenda, MaterialIds, RsvpDeadline.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SaveMeetingDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [NotEmptyGuid]
    public Guid EventId { get; set; }

    [Required]
    [StringLength(10000)]
    public string Agenda { get; set; } = string.Empty;
    [Required]
    public Guid[] MaterialIds { get; set; } = Array.Empty<Guid>();

    public DateTimeOffset? RsvpDeadline { get; set; } = null;
}
