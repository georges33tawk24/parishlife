// Purpose: records a new incident with its factual initial report.
// Main members: OperationId, OccurredAt, EventId, Location, PersonIds, Description, ImmediateActions, Witnesses and Urgent.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Care;

public class RecordIncidentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    public DateTimeOffset OccurredAt { get; set; }

    [NotEmptyGuid]
    public Guid? EventId { get; set; } = null;

    [StringLength(300)]
    public string? Location { get; set; } = null;

    [MaxLength(20)]
    public Guid[] PersonIds { get; set; } = Array.Empty<Guid>();

    [Required]
    [StringLength(8000)]
    public string Description { get; set; } = string.Empty;

    [StringLength(4000)]
    public string? ImmediateActions { get; set; } = null;

    [StringLength(2000)]
    public string? Witnesses { get; set; } = null;

    public bool Urgent { get; set; }
}
