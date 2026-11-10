// Purpose: submits actual volunteer hours for one assignment.
// Main members: OperationId, StartsAt, EndsAt, BreakMinutes and EvidenceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SubmitHoursDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    [Range(0, 1440)]
    public int BreakMinutes { get; set; }

    [StringLength(1000)]
    public string? EvidenceReference { get; set; } = null;
}
