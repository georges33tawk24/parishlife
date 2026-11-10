// Purpose: requests independent verification, correction or rejection of submitted hours.
// Main members: OperationId, Version, Action, corrected times/break and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class HoursActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(verify|correct|reject)$")]
    public string Action { get; set; } = string.Empty;

    public DateTimeOffset? StartsAt { get; set; } = null;

    public DateTimeOffset? EndsAt { get; set; } = null;

    [Range(0, 1440)]
    public int? BreakMinutes { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;
}
