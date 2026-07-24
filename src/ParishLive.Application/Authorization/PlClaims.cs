namespace ParishLive.Application.Authorization;

/// <summary>Claim types that carry a signed-in user's tenant + role context (set at sign-in).</summary>
public static class PlClaims
{
    public const string Org = "pl:org";
    public const string Parish = "pl:parish";          // one claim per parish the user belongs to
    public const string ArchAdmin = "pl:arch_admin";   // "true" / "false"
    public const string Role = "pl:role";              // one per distinct SystemRole
    public const string Name = "pl:name";              // the user's display name
}
