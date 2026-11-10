// Purpose: requests one milestone transition on a formation enrollment.
// Main members: OperationId, enrollment Version, MilestoneKey, Action and the conditional evidence, source, date, review and reason fields.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class FormationProgressDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^[a-z0-9][a-z0-9-]{0,39}$")]
    public string MilestoneKey { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(start|submit-evidence|review|complete|return|resubmit|reopen)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? EvidenceReference { get; set; } = null;

    [RegularExpression("^(Course|ExternalPriorLearning)$")]
    public string? Source { get; set; } = null;

    [StringLength(1000)]
    public string? ExternalProvenance { get; set; } = null;

    public DateOnly? AchievedOn { get; set; } = null;

    [StringLength(1000)]
    public string? ReviewReference { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;
}
