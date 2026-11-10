// Purpose: moves a website revision or section: submit, return, publish or unpublish.
// Main members: OperationId, Version, Action and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Publishing;

public class WebsiteActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(submit|return|publish|unpublish)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Reason { get; set; } = null;
}
