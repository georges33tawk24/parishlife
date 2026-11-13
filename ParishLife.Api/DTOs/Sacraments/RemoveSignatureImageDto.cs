// Purpose: removes the caller's current signature image so it is no longer attached to newly signed certificates; earlier files are kept.
// Main members: OperationId and Version.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class RemoveSignatureImageDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;
}
