// Purpose: completes a passkey sign-in with the browser's assertion credential JSON.
// Main members: State from the request-options call and Credential (PublicKeyCredential JSON).

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Accounts;

public class CompletePasskeyLoginDto
{
    [Required, StringLength(4096)]
    public string State { get; set; } = string.Empty;

    [Required, StringLength(16384)]
    public string Credential { get; set; } = string.Empty;
}
