// Purpose: sets the caller's own printed signer name used on documents they electronically authorize.
// Main members: OperationId, Version (required when replacing an existing profile) and PrintedName.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Documents;

public class SaveSignerProfileDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [StringLength(200, MinimumLength = 2)]
    public string PrintedName { get; set; } = string.Empty;
}
