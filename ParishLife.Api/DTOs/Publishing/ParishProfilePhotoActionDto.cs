// Purpose: publishes, unpublishes or removes one parish profile photograph, or changes its captions.
// Main members: OperationId, Version, Action (publish, unpublish, remove or caption), Caption and CaptionAr.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Publishing;

public class ParishProfilePhotoActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, RegularExpression("^(publish|unpublish|remove|caption)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(300)]
    public string? Caption { get; set; } = null;

    [StringLength(300)]
    public string? CaptionAr { get; set; } = null;
}
