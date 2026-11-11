// Purpose: completes passkey registration with the browser's attestation credential JSON.
// Main members: OperationId, State, Credential (PublicKeyCredential JSON) and an optional personal Name label.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class CompletePasskeyRegistrationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(4096)]
    public string State { get; set; } = string.Empty;

    [Required, StringLength(16384)]
    public string Credential { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Name { get; set; }
}
