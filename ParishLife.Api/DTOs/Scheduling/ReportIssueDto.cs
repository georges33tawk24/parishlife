// Purpose: reports a problem with a facility or equipment item.
// Main members: OperationId, ResourceId, ResourceKind, Description, Urgency and Evidence.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class ReportIssueDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid ResourceId { get; set; }

    [Required]
    [RegularExpression("^(Facility|Equipment)$")]
    public string ResourceKind { get; set; } = string.Empty;

    [Required]
    [StringLength(4000)]
    public string Description { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Low|Normal|Urgent|Hazard)$")]
    public string Urgency { get; set; } = "Normal";

    [StringLength(1000)]
    public string? Evidence { get; set; } = null;
}
