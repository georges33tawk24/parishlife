// Purpose: removes the holder's own stored signature image.
// Main members: OperationId (idempotent retry) and Version (the stored version being removed).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts.Signature;

public class RemoveAccountSignatureDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string Version { get; set; } = string.Empty;
}
