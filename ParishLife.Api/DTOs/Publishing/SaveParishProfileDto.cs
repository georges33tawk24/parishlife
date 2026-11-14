// Purpose: saves the draft of a parish public profile. The published copy is unchanged until an explicit publish action.
// Main members: OperationId, Version (null only for the first save) and Profile.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Publishing;

public class SaveParishProfileDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    public ParishProfileContentDto Profile { get; set; } = new();
}
