// Purpose: publishes the current draft of a parish public profile, or unpublishes the published copy.
// Main members: OperationId, Version and Action (publish or unpublish).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Publishing;

public class ParishProfileActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, RegularExpression("^(publish|unpublish)$")]
    public string Action { get; set; } = string.Empty;
}
