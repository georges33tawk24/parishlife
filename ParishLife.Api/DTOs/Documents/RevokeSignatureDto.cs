// Purpose: revokes one electronic authorization with an internal reason.
// Main members: OperationId and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Documents;

public class RevokeSignatureDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
