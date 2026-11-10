// Purpose: requests one loan transition with the conditional due date, condition, outcome, evidence and reason fields it needs.
// Main members: OperationId, Version, Action, DueAt, Condition, Outcome, Evidence and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class LoanActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(approve|decline|cancel|issue|return|check|report-missing|close)$")]
    public string Action { get; set; } = string.Empty;

    public DateTimeOffset? DueAt { get; set; } = null;

    [StringLength(500)]
    public string? Condition { get; set; } = null;

    [RegularExpression("^(Good|Damaged)$")]
    public string? Outcome { get; set; } = null;

    [StringLength(1000)]
    public string? Evidence { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;
}
