namespace ParishLive.Domain.Enums;

/// <summary>
/// Parish-level system roles held via the Membership entity (a user may hold different
/// roles in different parishes). Distinct from a user's per-group committee role.
/// </summary>
public enum SystemRole
{
    Archbishop,
    ArchdioceseAdmin,
    Priest,
    Secretary,
    Member,
    PublicVisitor
}
