using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Authorization;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Tenancy;

/// <summary>
/// After authentication, enriches the principal with tenant + role claims derived from the user's
/// memberships. Loads with IgnoreQueryFilters (the tenant filter isn't established yet), which also
/// avoids a chicken-and-egg cycle with <see cref="ClaimsTenantContext"/>.
/// </summary>
public sealed class MembershipClaimsTransformation : IClaimsTransformation
{
    private readonly AppDbContext _db;
    public MembershipClaimsTransformation(AppDbContext db) => _db = db;

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity is not ClaimsIdentity identity || !identity.IsAuthenticated)
            return principal;

        if (identity.HasClaim(c => c.Type == PlClaims.Org))
            return principal; // already enriched this request

        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return principal;

        var memberships = await _db.Memberships.IgnoreQueryFilters()
            .Where(m => m.UserId == userId)
            .ToListAsync();

        if (memberships.Count == 0)
            return principal;

        identity.AddClaim(new Claim(PlClaims.Org, memberships[0].OrgId.ToString()));

        foreach (var parishId in memberships.Select(m => m.ParishId).Distinct())
            identity.AddClaim(new Claim(PlClaims.Parish, parishId.ToString()));

        var isArchAdmin = memberships.Any(m => m.Role is SystemRole.Archbishop or SystemRole.ArchdioceseAdmin);
        identity.AddClaim(new Claim(PlClaims.ArchAdmin, isArchAdmin ? "true" : "false"));

        foreach (var role in memberships.Select(m => m.Role.ToString()).Distinct())
            identity.AddClaim(new Claim(PlClaims.Role, role));

        var displayName = await _db.Users.Where(u => u.Id == userId).Select(u => u.DisplayName).FirstOrDefaultAsync();
        if (!string.IsNullOrWhiteSpace(displayName))
            identity.AddClaim(new Claim(PlClaims.Name, displayName));

        return principal;
    }
}
