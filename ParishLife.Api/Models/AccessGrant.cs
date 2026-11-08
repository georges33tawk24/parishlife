// Purpose: records scoped allowed and denied permissions with effective dates and revocation.
// Main functions: Permits.

namespace ParishLife.Api.Models;

public class AccessGrant
{
    public string AccountId { get; set; } = string.Empty;

    public string[] Allows { get; set; } = Array.Empty<string>();

    public string[] Denies { get; set; } = Array.Empty<string>();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public bool Revoked { get; set; }

    public string GrantedBy { get; set; } = string.Empty;

    public string? DelegatingOrganizationId { get; set; } = null;

    public string? AssociationId { get; set; } = null;

    public bool Permits(string permission, DateTimeOffset now) => !Revoked && StartsAt <= now && (EndsAt is null || now < EndsAt) && !Denies.Contains(permission, StringComparer.Ordinal) && Allows.Contains(permission, StringComparer.Ordinal);
}
