// Purpose: shows real account-session state, including security-version invalidation and restricted recovery authentication.
// Main members: session identity/times/method and effective Status; From omits security stamps and computes current validity labels.

using ParishLife.Api.Identity;

namespace ParishLife.Api.DTOs.Accounts;

public class AccountSessionDto
{
    public string Id { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public bool Revoked { get; set; }

    public bool IsCurrent { get; set; }

    public string AuthenticationMethod { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public static AccountSessionDto From(AccountSession value, string? currentStamp, string? currentSession, DateTimeOffset now) => new()
    {
        Id = value.Id,
        CreatedAt = value.CreatedAt,
        ExpiresAt = value.ExpiresAt,
        Revoked = value.Revoked,
        IsCurrent = value.Id == currentSession,
        AuthenticationMethod = value.AuthenticationMethod == "legacy" ? "unknown" : value.AuthenticationMethod,
        Status = value.Revoked ? "Revoked" : value.ExpiresAt <= now ? "Expired"
            : value.SecurityStamp != currentStamp || value.AuthenticationMethod is not ("pwd" or "mfa" or "recovery") ? "Invalidated" : "Active"
    };
}
