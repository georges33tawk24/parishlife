// Purpose: asks for an email-ownership code for an existing unconfirmed account (neutral public response).
// Main members: Email.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Accounts;

public class RequestContactVerificationDto
{
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = string.Empty;
}
