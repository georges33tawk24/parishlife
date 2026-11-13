// Purpose: creates or edits a service plan (with EventId) or template (without), optionally copying a template.
// Main members: OperationId, Version, EventId, TemplateId, Title, PlanType, CoordinatorAccountId, CelebrantAccountId and Items; optional TitleAr (Arabic twin) and Language.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SavePlanDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [NotEmptyGuid]
    public Guid? EventId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? TemplateId { get; set; } = null;

    [Required]
    [StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [StringLength(300)]
    public string? TitleAr { get; set; } = null;

    [StringLength(10)]
    public string? Language { get; set; } = null;

    [Required]
    [RegularExpression("^(Liturgy|Activity)$")]
    public string PlanType { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid CoordinatorAccountId { get; set; }

    [NotEmptyGuid]
    public Guid? CelebrantAccountId { get; set; } = null;

    [Required]
    [MaxLength(80)]
    public PlanItemDto[] Items { get; set; } = Array.Empty<PlanItemDto>();
}
