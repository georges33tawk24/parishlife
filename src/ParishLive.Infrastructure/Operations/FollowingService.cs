using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed class FollowingService(AppDbContext db, ITenantContext tenant, OperationRunner operations)
{
    public async Task SetAsync(Guid parishId, bool following, bool primary, Guid operationId)
    {
        var user = tenant.UserId ?? throw new ForbiddenException("Error.Unavailable");
        if (primary && !following) throw new DomainException("Error.Invalid");
        if (following && !await db.Parishes.IgnoreQueryFilters().AnyAsync(p => p.Id == parishId && p.PubliclyListed && p.Lifecycle == "Active"))
            throw new DomainException("Error.Unavailable");
        await operations.RunAsync(parishId, operationId, "Following.Set", new { parishId, following, primary }, async () =>
        {
            var rows = await db.ParishFollows.Where(f => f.UserId == user).ToListAsync();
            var row = rows.SingleOrDefault(f => f.ParishId == parishId);
            if (primary) foreach (var other in rows) other.IsPrimary = false;
            if (!following && row is not null) db.ParishFollows.Remove(row);
            if (following && row is null) { row = new ParishFollow { UserId = user, ParishId = parishId }; db.ParishFollows.Add(row); }
            if (following) row!.IsPrimary = primary;
            await db.SaveChangesAsync(); return new(parishId, 1);
        });
    }
}
