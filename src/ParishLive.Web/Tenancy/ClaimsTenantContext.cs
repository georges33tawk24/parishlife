using System.Security.Claims;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Authorization;

namespace ParishLive.Web.Tenancy;

/// <summary>
/// Resolves the tenant context from the signed-in user's claims. Reads live on each access (not
/// cached in the ctor) so it is correct even when first touched before the claims transformation runs.
/// </summary>
public sealed class ClaimsTenantContext : ITenantContext
{
    private readonly IHttpContextAccessor _accessor;
    public ClaimsTenantContext(IHttpContextAccessor accessor) => _accessor = accessor;

    private ClaimsPrincipal? User => _accessor.HttpContext?.User;

    public string? UserId => User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    public Guid OrgId =>
        Guid.TryParse(User?.FindFirst(PlClaims.Org)?.Value, out var g) ? g : Guid.Empty;

    public IReadOnlyCollection<Guid> ParishIds =>
        User?.FindAll(PlClaims.Parish)
            .Select(c => Guid.TryParse(c.Value, out var p) ? p : Guid.Empty)
            .Where(p => p != Guid.Empty)
            .ToArray()
        ?? Array.Empty<Guid>();

    public bool IsArchdioceseAdmin => User?.HasClaim(PlClaims.ArchAdmin, "true") ?? false;
}
