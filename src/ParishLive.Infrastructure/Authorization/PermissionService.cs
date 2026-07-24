using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Authorization;
using ParishLive.Application.Common;
using ParishLive.Domain.Constants;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Authorization;

/// <summary>
/// Resolves a user's effective permissions in a parish: their membership's system role → the matching
/// configurable Role → its granted permissions. Because the grants are data (RolePermission), a priest
/// can reconfigure a secretary's abilities without a code change.
/// </summary>
public sealed class PermissionService(AppDbContext db) : IPermissionService
{
    public async Task<IReadOnlySet<string>> GetPermissionsAsync(string userId, Guid parishId, CancellationToken cancellationToken = default)
    {
        // Keyed by explicit user + parish, so bypass the tenant filter (this runs during claims building too).
        var membership = await db.Memberships.IgnoreQueryFilters()
            .FirstOrDefaultAsync(m => m.UserId == userId && m.ParishId == parishId, cancellationToken);

        if (membership is null)
            return new HashSet<string>();

        var roleCode = ToRoleCode(membership.Role);

        var permissions = await (
            from rp in db.RolePermissions
            join role in db.ParishRoles on rp.RoleId equals role.Id
            join permission in db.Permissions on rp.PermissionId equals permission.Id
            where role.Code == roleCode && (role.ParishId == null || role.ParishId == parishId)
            select permission.Code)
            .Distinct()
            .ToListAsync(cancellationToken);

        return permissions.ToHashSet();
    }

    public async Task<bool> HasAsync(string userId, Guid parishId, string permissionCode, CancellationToken cancellationToken = default) =>
        (await GetPermissionsAsync(userId, parishId, cancellationToken)).Contains(permissionCode);

    public async Task RequireAsync(string userId, Guid parishId, string permissionCode, CancellationToken cancellationToken = default)
    {
        if (!await HasAsync(userId, parishId, permissionCode, cancellationToken))
            throw new ForbiddenException($"Permission '{permissionCode}' is required.");
    }

    private static string ToRoleCode(SystemRole role) => role switch
    {
        SystemRole.Archbishop => RoleCodes.Archbishop,
        SystemRole.ArchdioceseAdmin => RoleCodes.ArchdioceseAdmin,
        SystemRole.Priest => RoleCodes.Priest,
        SystemRole.Secretary => RoleCodes.Secretary,
        SystemRole.Member => RoleCodes.Member,
        _ => RoleCodes.PublicVisitor
    };
}
