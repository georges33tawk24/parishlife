using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>Grants a permission to a role. Editing these rows reconfigures a role's abilities — no code change.</summary>
public sealed class RolePermission : AuditableEntity
{
    private RolePermission() { }

    public Guid RoleId { get; private set; }
    public Guid PermissionId { get; private set; }

    public static RolePermission Create(Guid roleId, Guid permissionId) => new()
    {
        RoleId = Guard.NotEmpty(roleId, "RoleId"),
        PermissionId = Guard.NotEmpty(permissionId, "PermissionId")
    };
}
