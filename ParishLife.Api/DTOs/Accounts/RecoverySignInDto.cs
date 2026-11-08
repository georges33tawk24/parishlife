// Purpose: describes a committed restricted recovery session without implying normal MFA or administrative access.
// Main members: Account, ExpiresAt, AuthenticationMethod.

namespace ParishLife.Api.DTOs.Accounts;

public class RecoverySignInDto
{
    public AccountDto Account { get; set; } = new();

    public DateTimeOffset ExpiresAt { get; set; }

    public string AuthenticationMethod { get; set; } = "recovery";
}
