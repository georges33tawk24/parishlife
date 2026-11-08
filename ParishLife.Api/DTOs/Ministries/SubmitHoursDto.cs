// Purpose: represents submit hours input/output data.
// Main members: OperationId, EventId, StartsAt, EndsAt, BreakMinutes, EvidenceReference, PersonId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SubmitHoursDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [NotEmptyGuid]
    public Guid EventId { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int BreakMinutes { get; set; }

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;
    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;
}
