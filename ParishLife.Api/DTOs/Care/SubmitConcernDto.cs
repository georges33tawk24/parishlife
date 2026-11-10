// Purpose: submits a confidential concern to chosen independent reviewers, or to every eligible one when none is chosen.
// Main members: OperationId, Category, Urgency, Summary, Details, Anonymous, ReviewerIds and ImplicatedAccountIds.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Care;

public class SubmitConcernDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(Operational|Interpersonal|Safeguarding|Other)$")]
    public string Category { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Normal|Urgent)$")]
    public string Urgency { get; set; } = "Normal";

    [Required]
    [StringLength(300)]
    public string Summary { get; set; } = string.Empty;

    [StringLength(20000)]
    public string Details { get; set; } = string.Empty;

    public bool Anonymous { get; set; }

    [Required]
    [MaxLength(3)]
    public string[] ReviewerIds { get; set; } = Array.Empty<string>();

    [Required]
    [MaxLength(10)]
    public Guid[] ImplicatedAccountIds { get; set; } = Array.Empty<Guid>();
}
