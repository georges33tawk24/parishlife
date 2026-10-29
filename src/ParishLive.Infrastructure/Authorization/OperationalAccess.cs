using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Authorization;

public sealed class OperationalAccess(AppDbContext db, ITenantContext tenant)
{
    public string UserId => tenant.UserId ?? throw new ForbiddenException("Error.Unavailable");

    public async Task<Membership> RequireAsync(Guid parishId, params SystemRole[] roles)
    {
        var userId = UserId;
        var parish = await db.Parishes.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(p => p.Id == parishId);
        if (parish is null) throw new ForbiddenException("Error.Unavailable");
        var candidates = (await db.Memberships.IgnoreQueryFilters().AsNoTracking()
            .Where(m => m.UserId == userId && m.OrgId == parish.OrgId && (m.ParishId == parishId ||
                m.ParishId == Guid.Empty && (m.Role == SystemRole.Archbishop || m.Role == SystemRole.ArchdioceseAdmin))).ToListAsync())
            .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
        if (tenant.ActingAssignmentId is null && tenant.ActingRole is not null)
            candidates = candidates.Where(m => m.Role.ToString() == tenant.ActingRole).ToList();
        var selected = tenant.ActingAssignmentId is Guid id ? candidates.SingleOrDefault(m => m.Id == id)
            : candidates.Count == 1 ? candidates[0] : null;
        if (selected is null || !roles.Contains(selected.Role)) throw new ForbiddenException("Error.Unavailable");
        if (parish is null || parish.OrgId != selected.OrgId) throw new ForbiddenException("Error.Unavailable");
        return selected;
    }

    public Task<Membership> OfficeAsync(Guid parishId) => RequireAsync(parishId,
        SystemRole.Priest, SystemRole.Secretary, SystemRole.ParishAdmin, SystemRole.ArchdioceseAdmin);

    public Task<Membership> FinanceAsync(Guid parishId, bool write = false) => write
        ? RequireAsync(parishId, SystemRole.Treasurer)
        : RequireAsync(parishId, SystemRole.Treasurer, SystemRole.FinanceViewer);

    public async Task RequireGroupAsync(Guid parishId, Guid groupId, bool priestOnly = false)
    {
        var assignment = await RequireAsync(parishId, priestOnly ? [SystemRole.Priest]
            : [SystemRole.Priest, SystemRole.MinistryLeader]);
        if (assignment.Role == SystemRole.MinistryLeader && assignment.GroupId != groupId)
            throw new ForbiddenException("Error.Unavailable");
    }
}
