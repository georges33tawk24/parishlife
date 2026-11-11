// Purpose: safe projection of a linked external sign-in provider; the provider subject is never returned.
// Main members: Provider and LinkedAt.

namespace ParishLife.Api.DTOs.Accounts;

public class ExternalLoginDto
{
    public string Provider { get; set; } = string.Empty;

    public DateTimeOffset LinkedAt { get; set; }
}
