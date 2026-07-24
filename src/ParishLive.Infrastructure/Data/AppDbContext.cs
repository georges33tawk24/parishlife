using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Identity;

namespace ParishLive.Infrastructure.Data;

/// <summary>
/// The application DbContext. Tenant isolation is enforced here — the security backstop — by
/// EF Core global query filters (reads) and a SaveChanges guard (writes). Both consult the
/// request-scoped <see cref="ITenantContext"/> resolved from the signed-in user's claims (Part 7).
/// </summary>
public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    private readonly ITenantContext _tenant;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenant) : base(options)
        => _tenant = tenant;

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Parish> Parishes => Set<Parish>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Notice> Notices => Set<Notice>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();

    // Configurable workflow engine (reference/config data — not tenant-filtered; ParishId null = archdiocese default).
    public DbSet<WorkflowDefinition> WorkflowDefinitions => Set<WorkflowDefinition>();
    public DbSet<WorkflowState> WorkflowStates => Set<WorkflowState>();
    public DbSet<WorkflowTransition> WorkflowTransitions => Set<WorkflowTransition>();

    public DbSet<Venue> Venues => Set<Venue>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<ReservationStateHistory> ReservationStateHistory => Set<ReservationStateHistory>();

    // Configurable RBAC (config data; ParishRoles avoids clashing with Identity's Roles).
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<Role> ParishRoles => Set<Role>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventRegistration> EventRegistrations => Set<EventRegistration>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // A parish user sees only their parish(es); an archdiocese admin sees across their org.
        // Written as a boolean expression (not a ternary) so EF translates it to SQL cleanly.
        b.Entity<Parish>().HasQueryFilter(p =>
            (_tenant.IsArchdioceseAdmin && p.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(p.Id)));

        b.Entity<Notice>().HasQueryFilter(n =>
            (_tenant.IsArchdioceseAdmin && n.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(n.ParishId)));

        b.Entity<Membership>().HasQueryFilter(m =>
            (_tenant.IsArchdioceseAdmin && m.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(m.ParishId)));

        b.Entity<Group>().HasQueryFilter(g =>
            (_tenant.IsArchdioceseAdmin && g.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(g.ParishId)));

        b.Entity<GroupMember>().HasQueryFilter(gm =>
            (_tenant.IsArchdioceseAdmin && gm.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(gm.ParishId)));

        b.Entity<Venue>().HasQueryFilter(v =>
            (_tenant.IsArchdioceseAdmin && v.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(v.ParishId)));

        b.Entity<Reservation>().HasQueryFilter(r =>
            (_tenant.IsArchdioceseAdmin && r.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(r.ParishId)));

        b.Entity<ReservationStateHistory>().HasQueryFilter(h =>
            (_tenant.IsArchdioceseAdmin && h.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(h.ParishId)));

        b.Entity<Event>().HasQueryFilter(e =>
            (_tenant.IsArchdioceseAdmin && e.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(e.ParishId)));

        b.Entity<EventRegistration>().HasQueryFilter(er =>
            (_tenant.IsArchdioceseAdmin && er.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(er.ParishId)));

        b.Entity<AuditLog>().HasQueryFilter(a =>
            (_tenant.IsArchdioceseAdmin && a.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && _tenant.ParishIds.Contains(a.ParishId)));

        b.Entity<Membership>().HasIndex(m => m.UserId);
        b.Entity<Membership>().HasIndex(m => m.ParishId);
        b.Entity<Notice>().HasIndex(n => n.ParishId);
        b.Entity<Group>().HasIndex(g => g.ParishId);
        b.Entity<GroupMember>().HasIndex(gm => gm.UserId);
        b.Entity<GroupMember>().HasIndex(gm => gm.GroupId);
        b.Entity<Venue>().HasIndex(v => v.ParishId);
        b.Entity<Reservation>().HasIndex(r => new { r.ParishId, r.StartUtc });
        b.Entity<Reservation>().HasIndex(r => r.CurrentStateId);
        b.Entity<ReservationStateHistory>().HasIndex(h => h.ReservationId);
        b.Entity<Event>().HasIndex(e => e.ParishId);
        b.Entity<EventRegistration>().HasIndex(er => new { er.EventId, er.UserId }).IsUnique();
        b.Entity<AuditLog>().HasIndex(a => new { a.ParishId, a.CreatedAt });
    }

    public override int SaveChanges()
    {
        ApplyTenantGuard();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantGuard();
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// WITH CHECK equivalent: stamp tenant keys on new rows from the current user, and refuse any
    /// insert/update into a parish the user does not belong to. Client-supplied ParishId is never trusted.
    /// </summary>
    private void ApplyTenantGuard()
    {
        foreach (var entry in ChangeTracker.Entries<TenantEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.OrgId == Guid.Empty)
                    entry.Entity.OrgId = _tenant.OrgId;
                if (entry.Entity.ParishId == Guid.Empty && _tenant.ParishIds.Count == 1)
                    entry.Entity.ParishId = _tenant.ParishIds.First();
            }

            if (entry.State is EntityState.Added or EntityState.Modified)
            {
                var allowed = _tenant.IsArchdioceseAdmin
                    ? entry.Entity.OrgId == _tenant.OrgId
                    : _tenant.ParishIds.Contains(entry.Entity.ParishId);

                if (!allowed)
                    throw new InvalidOperationException(
                        $"Tenant guard: not allowed to write {entry.Entity.GetType().Name} into parish {entry.Entity.ParishId}.");
            }
        }
    }
}
