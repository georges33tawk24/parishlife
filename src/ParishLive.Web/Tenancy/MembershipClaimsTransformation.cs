using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Authorization;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Tenancy;

/// <summary>Live appointments, rebuilt per request. Context belongs to the tab URL, never a shared cookie.</summary>
public sealed class MembershipClaimsTransformation(AppDbContext db, IHttpContextAccessor accessor) : IClaimsTransformation
{
    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true) return principal;
        var copy = principal.Clone();
        foreach (var identity in copy.Identities)
            foreach (var claim in identity.Claims.Where(c => c.Type.StartsWith("pl:", StringComparison.Ordinal)).ToList())
                identity.RemoveClaim(claim);
        var target = (ClaimsIdentity)copy.Identity!;
        var userId = copy.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId);
        if (user is null || user.LockoutEnd > DateTimeOffset.UtcNow) return new ClaimsPrincipal(new ClaimsIdentity());
        target.AddClaim(new Claim(PlClaims.Name, user.DisplayName ?? user.UserName ?? ""));
        var all = (await db.Memberships.IgnoreQueryFilters().AsNoTracking()
            .Where(m => m.UserId == userId).ToListAsync()).Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
        var work = all.Where(m => m.Role is not (SystemRole.Member or SystemRole.PublicVisitor)).ToList();
        var choices = work.Count > 0 ? work : all;
        var raw = accessor.HttpContext?.Request.Query["actingAs"].ToString();
        var selected = Guid.TryParse(raw, out var requested)
            ? choices.SingleOrDefault(m => m.Id == requested)
            : choices.Count == 1 ? choices[0] : null;
        if (selected is null) return copy;
        target.AddClaim(new Claim(PlClaims.Assignment, selected.Id.ToString()));
        target.AddClaim(new Claim(PlClaims.Org, selected.OrgId.ToString()));
        if (selected.ParishId != Guid.Empty) target.AddClaim(new Claim(PlClaims.Parish, selected.ParishId.ToString()));
        target.AddClaim(new Claim(PlClaims.ArchAdmin,
            selected.Role is SystemRole.Archbishop or SystemRole.ArchdioceseAdmin ? "true" : "false"));
        target.AddClaim(new Claim(PlClaims.Role, selected.Role.ToString()));
        return copy;
    }
}
