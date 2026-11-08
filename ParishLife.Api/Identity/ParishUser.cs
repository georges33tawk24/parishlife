// Purpose: Defines persisted account/security state separately from parish Person records; LoginAlias retains its
// legacy field shape.
// Main members: AccountSession, LoginAlias, MfaChallenge, ParishUser.

using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;

namespace ParishLife.Api.Identity;

public sealed class ParishUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public bool Active { get; set; }
    public bool PlatformOperator { get; set; }
    public bool IdentityVerified { get; set; }
    public string? AuthenticatorKey { get; set; }
    public string? ProtectedRecoveryCodes { get; set; }
    public string? ContactVerificationReference { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    [JsonIgnore]
    public string? PersistenceVersion { get; set; }
}

public sealed record LoginAlias(string AccountId, string NormalizedEmail, bool Active, string Kind = "email");
public sealed record AccountSession(string Id, string AccountId, string SecurityStamp, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, bool Revoked = false, string AuthenticationMethod = "legacy");
public sealed record MfaChallenge(string Id, string AccountId, string SecurityStamp, DateTimeOffset ExpiresAt, bool Consumed = false);
