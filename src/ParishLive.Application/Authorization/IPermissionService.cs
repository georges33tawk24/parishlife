namespace ParishLive.Application.Authorization;

/// <summary>
/// Resolves a user's effective permissions in a parish (membership → role → permissions) and enforces them.
/// Configurable: which permissions a role grants is data (RolePermission), so a priest can, e.g., limit
/// what a secretary may do without any code change.
/// </summary>
public interface IPermissionService
{
    Task<IReadOnlySet<string>> GetPermissionsAsync(string userId, Guid parishId, CancellationToken cancellationToken = default);

    Task<bool> HasAsync(string userId, Guid parishId, string permissionCode, CancellationToken cancellationToken = default);

    Task RequireAsync(string userId, Guid parishId, string permissionCode, CancellationToken cancellationToken = default);
}
