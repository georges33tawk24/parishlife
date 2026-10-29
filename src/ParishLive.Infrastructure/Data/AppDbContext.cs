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
    public DbSet<ParishPolicy> ParishPolicies => Set<ParishPolicy>();
    public DbSet<ServiceCase> ServiceCases => Set<ServiceCase>();
    public DbSet<CaseHistory> CaseHistories => Set<CaseHistory>();
    public DbSet<CaseEvidence> CaseEvidence => Set<CaseEvidence>();
    public DbSet<CertificateRecord> Certificates => Set<CertificateRecord>();
    public DbSet<OperationReceipt> Operations => Set<OperationReceipt>();
    public DbSet<AccountNotification> AccountNotifications => Set<AccountNotification>();
    public DbSet<PersonRecord> People => Set<PersonRecord>();
    public DbSet<HouseholdRecord> Households => Set<HouseholdRecord>();
    public DbSet<RepresentationGrant> RepresentationGrants => Set<RepresentationGrant>();
    public DbSet<ParishFollow> ParishFollows => Set<ParishFollow>();
    public DbSet<MembershipReview> MembershipReviews => Set<MembershipReview>();
    public DbSet<MinistryApplication> MinistryApplications => Set<MinistryApplication>();
    public DbSet<MeetingAttendance> MeetingAttendance => Set<MeetingAttendance>();
    public DbSet<EventAdmission> EventAdmissions => Set<EventAdmission>();
    public DbSet<AttendanceMovement> AttendanceMovements => Set<AttendanceMovement>();
    public DbSet<LedgerMovement> LedgerMovements => Set<LedgerMovement>();
    public DbSet<MovementAllocation> MovementAllocations => Set<MovementAllocation>();
    public DbSet<FinancialRequest> FinancialRequests => Set<FinancialRequest>();
    public DbSet<GivingBatch> GivingBatches => Set<GivingBatch>();
    public DbSet<GivingLine> GivingLines => Set<GivingLine>();
    public DbSet<PrivateNotebook> PrivateNotebooks => Set<PrivateNotebook>();
    public DbSet<ConcernRecord> Concerns => Set<ConcernRecord>();
    public DbSet<ConcernAccess> ConcernAccess => Set<ConcernAccess>();
    public DbSet<ConcernLog> ConcernLogs => Set<ConcernLog>();
    public DbSet<ContentPage> ContentPages => Set<ContentPage>();
    public DbSet<AdministrativeRecord> AdministrativeRecords => Set<AdministrativeRecord>();
    public DbSet<AdministrativeChangeRequest> AdministrativeChanges => Set<AdministrativeChangeRequest>();
    public DbSet<GuestAccess> GuestAccess => Set<GuestAccess>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        ConfigureOperationalModel(b);

        // A parish user sees only their parish(es); an archdiocese admin sees across their org.
        // Written as a boolean expression (not a ternary) so EF translates it to SQL cleanly.
        b.Entity<Parish>().HasQueryFilter(p =>
            (_tenant.IsArchdioceseAdmin && p.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && p.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(p.Id)));

        b.Entity<Notice>().HasQueryFilter(n =>
            (_tenant.IsArchdioceseAdmin && n.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && n.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(n.ParishId)));

        b.Entity<Membership>().HasQueryFilter(m =>
            (_tenant.IsArchdioceseAdmin && m.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && m.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(m.ParishId)));

        b.Entity<Group>().HasQueryFilter(g =>
            (_tenant.IsArchdioceseAdmin && g.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && g.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(g.ParishId)));

        b.Entity<GroupMember>().HasQueryFilter(gm =>
            (_tenant.IsArchdioceseAdmin && gm.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && gm.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(gm.ParishId)));

        b.Entity<Venue>().HasQueryFilter(v =>
            (_tenant.IsArchdioceseAdmin && v.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && v.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(v.ParishId)));

        b.Entity<Reservation>().HasQueryFilter(r =>
            (_tenant.IsArchdioceseAdmin && r.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && r.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(r.ParishId)));

        b.Entity<ReservationStateHistory>().HasQueryFilter(h =>
            (_tenant.IsArchdioceseAdmin && h.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && h.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(h.ParishId)));

        b.Entity<Event>().HasQueryFilter(e =>
            (_tenant.IsArchdioceseAdmin && e.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && e.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(e.ParishId)));

        b.Entity<EventRegistration>().HasQueryFilter(er =>
            (_tenant.IsArchdioceseAdmin && er.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && er.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(er.ParishId)));

        b.Entity<AuditLog>().HasQueryFilter(a =>
            (_tenant.IsArchdioceseAdmin && a.OrgId == _tenant.OrgId) ||
            (!_tenant.IsArchdioceseAdmin && a.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(a.ParishId)));

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

    public override int SaveChanges() => SaveChanges(true);

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ApplyTenantGuard();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => SaveChangesAsync(true, cancellationToken);

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ApplyTenantGuard();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>
    /// WITH CHECK equivalent: stamp tenant keys on new rows from the current user, and refuse any
    /// insert/update into a parish the user does not belong to. Client-supplied ParishId is never trusted.
    /// </summary>
    private void ApplyTenantGuard()
    {
        if (ChangeTracker.Entries<AdministrativeRecord>().Any(e => e.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Administrative history is immutable.");
        var writes = ChangeTracker.Entries<TenantEntity>().Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList();
        var owningParishIds = writes.Select(e => e.Entity.ParishId).Where(id => id != Guid.Empty).Distinct().ToList();
        var organizations = Parishes.IgnoreQueryFilters().AsNoTracking().Where(p => owningParishIds.Contains(p.Id))
            .ToDictionary(p => p.Id, p => p.OrgId);
        foreach (var parish in ChangeTracker.Entries<Parish>().Where(p => p.State == EntityState.Added))
            organizations[parish.Entity.Id] = parish.Entity.OrgId;
        foreach (var entry in ChangeTracker.Entries<VersionedRecord>())
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.Revision = entry.Property(e => e.Revision).OriginalValue + 1;
                entry.Entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        foreach (var entry in ChangeTracker.Entries<TenantEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.OrgId == Guid.Empty)
                    entry.Entity.OrgId = _tenant.OrgId;
                if (entry.Entity.ParishId == Guid.Empty && _tenant.ParishIds.Count == 1)
                    entry.Entity.ParishId = _tenant.ParishIds.First();
            }

            if (entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            {
                if (entry.Entity.ParishId != Guid.Empty && (!organizations.TryGetValue(entry.Entity.ParishId, out var actualOrg) || actualOrg != entry.Entity.OrgId))
                    throw new InvalidOperationException("The parish and organization do not match.");
                var allowed = _tenant.IsArchdioceseAdmin
                    ? entry.Entity.OrgId == _tenant.OrgId
                    : entry.Entity.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(entry.Entity.ParishId);
                // Authenticated own-case tracking is independent of parish membership.
                // This narrow allowance cannot create staff/official authority.
                if (!allowed && _tenant.UserId is not null)
                {
                    if (entry.Entity is ServiceCase own && own.RequesterUserId == _tenant.UserId)
                        allowed = entry.State == EntityState.Added && own.Stage is CaseStage.Draft or CaseStage.Received ||
                            entry.State == EntityState.Modified &&
                            entry.Property(nameof(ServiceCase.Stage)).OriginalValue is CaseStage original &&
                            (original == CaseStage.Draft && own.Stage is CaseStage.Draft or CaseStage.Received or CaseStage.Cancelled ||
                             original == CaseStage.Received && own.Stage == CaseStage.Cancelled);
                    if (!allowed && entry.Entity is ServiceCase evidenceCase && evidenceCase.RequesterUserId == _tenant.UserId &&
                        entry.State == EntityState.Modified &&
                        entry.Properties.Where(p => p.IsModified).All(p => p.Metadata.Name is nameof(VersionedRecord.Revision) or nameof(VersionedRecord.UpdatedAtUtc)) &&
                        ChangeTracker.Entries<CaseEvidence>().Any(e => e.State == EntityState.Added && e.Entity.CaseId == evidenceCase.Id && e.Entity.SuppliedByUserId == _tenant.UserId)) allowed = true;
                    if (entry.Entity is OperationReceipt op && op.ActorUserId == _tenant.UserId && op.Action.StartsWith("Case.")) allowed = true;
                    if (entry.Entity is MembershipReview review && entry.State == EntityState.Added && review.ApplicantUserId == _tenant.UserId && review.Status == "Submitted") allowed = true;
                    if (entry.Entity is OperationReceipt membershipOperation && membershipOperation.ActorUserId == _tenant.UserId && membershipOperation.Action == "Membership.Request") allowed = true;
                    if (entry.Entity is OperationReceipt followOperation && followOperation.ActorUserId == _tenant.UserId && followOperation.Action == "Following.Set") allowed = true;
                    if (entry.Entity is CaseEvidence supplied && entry.State == EntityState.Added && supplied.SuppliedByUserId == _tenant.UserId &&
                        supplied.Status == EvidenceStatus.Uploaded && ServiceCases.IgnoreQueryFilters().Any(c => c.Id == supplied.CaseId &&
                            c.ParishId == supplied.ParishId && c.RequesterUserId == _tenant.UserId &&
                            c.Stage != CaseStage.Registered && c.Stage != CaseStage.Cancelled && c.Stage != CaseStage.Declined)) allowed = true;
                    if (entry.Entity is OperationReceipt uploadOperation && uploadOperation.ActorUserId == _tenant.UserId && uploadOperation.Action == "Evidence.Upload") allowed = true;
                    if (entry.Entity is CaseHistory history)
                        allowed = ChangeTracker.Entries<ServiceCase>().Any(c => c.Entity.Id == history.CaseId && c.Entity.RequesterUserId == _tenant.UserId &&
                            c.Entity.Stage is CaseStage.Draft or CaseStage.Received or CaseStage.Cancelled);
                }

                if (entry.State != EntityState.Added &&
                    (entry.Property(e => e.OrgId).IsModified || entry.Property(e => e.ParishId).IsModified))
                    throw new InvalidOperationException("Record ownership cannot be changed.");

                if (entry.State != EntityState.Added && entry.Entity is
                    LedgerMovement or OperationReceipt or CaseHistory or AttendanceMovement or AuditLog or ConcernLog)
                    throw new InvalidOperationException("This history is immutable; append a correction.");
                if (entry.Entity is ServiceCase && entry.State == EntityState.Modified &&
                    entry.Property(nameof(ServiceCase.Stage)).OriginalValue is CaseStage.Registered &&
                    (entry.Property(nameof(ServiceCase.OfficialSnapshotJson)).IsModified || entry.Property(nameof(ServiceCase.RegisterReference)).IsModified ||
                     entry.Property(nameof(ServiceCase.Stage)).IsModified))
                    throw new InvalidOperationException("Registered facts are immutable; use an official amendment.");
                if (entry.Entity is GivingBatch && entry.State != EntityState.Added &&
                    entry.Property(nameof(GivingBatch.Status)).OriginalValue is "Closed")
                    throw new InvalidOperationException("Closed giving is immutable.");
                if (entry.Entity is GivingLine line && entry.State != EntityState.Added &&
                    GivingBatches.IgnoreQueryFilters().Any(b => b.Id == line.BatchId && b.Status == "Closed"))
                    throw new InvalidOperationException("Closed giving lines are immutable.");

                if (!allowed)
                    throw new InvalidOperationException(
                        $"Tenant guard: not allowed to write {entry.Entity.GetType().Name} into parish {entry.Entity.ParishId}.");
            }
        }
    }

    private void OperationalFilter<T>(ModelBuilder b) where T : TenantEntity
    {
        b.Entity<T>().HasBaseType((Type?)null);
        b.Entity<T>().HasQueryFilter(x => x.OrgId == _tenant.OrgId &&
            (_tenant.IsArchdioceseAdmin || _tenant.ParishIds.Contains(x.ParishId)));
        b.Entity<T>().HasIndex(x => new { x.ParishId, x.Id });
        if (typeof(VersionedRecord).IsAssignableFrom(typeof(T)))
            b.Entity<T>().Property(nameof(VersionedRecord.Revision)).IsConcurrencyToken();
    }

    private void ConfigureOperationalModel(ModelBuilder b)
    {
        OperationalFilter<ParishPolicy>(b); OperationalFilter<ServiceCase>(b);
        OperationalFilter<CaseHistory>(b); OperationalFilter<CaseEvidence>(b);
        OperationalFilter<CertificateRecord>(b); OperationalFilter<OperationReceipt>(b);
        OperationalFilter<PersonRecord>(b); OperationalFilter<HouseholdRecord>(b);
        OperationalFilter<RepresentationGrant>(b); OperationalFilter<MembershipReview>(b);
        OperationalFilter<MinistryApplication>(b); OperationalFilter<MeetingAttendance>(b);
        OperationalFilter<EventAdmission>(b); OperationalFilter<AttendanceMovement>(b);
        OperationalFilter<LedgerMovement>(b); OperationalFilter<MovementAllocation>(b);
        OperationalFilter<FinancialRequest>(b); OperationalFilter<GivingBatch>(b);
        OperationalFilter<GivingLine>(b); OperationalFilter<PrivateNotebook>(b);
        OperationalFilter<ConcernRecord>(b); OperationalFilter<ConcernAccess>(b);
        OperationalFilter<ConcernLog>(b);
        OperationalFilter<ContentPage>(b);
        OperationalFilter<GuestAccess>(b);
        b.Entity<GuestAccess>().HasIndex(x => x.TokenHash).IsUnique();
        // Privacy is a separate boundary from organizational rank, including aggregate queries.
        b.Entity<ConcernRecord>().HasQueryFilter(x => x.SubmitterUserId == _tenant.UserId ||
            ConcernAccess.Any(a => a.ConcernId == x.Id && a.ReviewerUserId == _tenant.UserId &&
                !a.Revoked && !a.Conflicted && (!x.Sensitive || a.CanViewSensitive)));
        b.Entity<ConcernAccess>().HasQueryFilter(x => x.ReviewerUserId == _tenant.UserId && !x.Revoked && !x.Conflicted &&
            _tenant.ActingRole == "ConcernReviewer" && x.OrgId == _tenant.OrgId && _tenant.ParishIds.Contains(x.ParishId));
        b.Entity<ConcernLog>().HasQueryFilter(x => Concerns.Any(c => c.Id == x.ConcernId));
        b.Entity<MinistryApplication>().HasQueryFilter(x => x.OrgId == _tenant.OrgId &&
            _tenant.ParishIds.Contains(x.ParishId) && (!x.IsDeparture || x.ApplicantUserId == _tenant.UserId || _tenant.ActingRole == "Priest"));
        b.Entity<PrivateNotebook>().HasQueryFilter(x => x.OrgId == _tenant.OrgId &&
            _tenant.ParishIds.Contains(x.ParishId) &&
            (x.AuthorUserId == _tenant.UserId ||
                (_tenant.ActingRole == "Priest" && (x.AssigneeUserId == _tenant.UserId || x.Audience == "CurrentPriests"))));
        b.Entity<AccountNotification>().HasQueryFilter(x => x.RecipientUserId == _tenant.UserId);
        b.Entity<ParishFollow>().HasQueryFilter(x => x.UserId == _tenant.UserId);
        b.Entity<OperationReceipt>().HasIndex(x => new { x.ActorUserId, x.OperationId }).IsUnique();
        b.Entity<AccountNotification>().HasIndex(x => new { x.RecipientUserId, x.OperationId, x.MessageCode }).IsUnique();
        b.Entity<ParishPolicy>().HasIndex(x => x.ParishId).IsUnique();
        b.Entity<ServiceCase>().HasIndex(x => x.Reference).IsUnique();
        b.Entity<PersonRecord>().HasIndex(x => new { x.ParishId, x.LinkedUserId }).IsUnique().HasFilter("\"LinkedUserId\" IS NOT NULL");
        b.Entity<ParishFollow>().HasIndex(x => new { x.UserId, x.ParishId }).IsUnique();
        b.Entity<EventAdmission>().HasIndex(x => new { x.EventId, x.ParticipantUserId }).IsUnique();
        b.Entity<LedgerMovement>().HasIndex(x => new { x.ParishId, x.SourceReference }).IsUnique();
        b.Entity<MeetingAttendance>().HasIndex(x => new { x.EventId, x.ParticipantUserId }).IsUnique();
        b.Entity<MinistryApplication>().HasIndex(x => new { x.GroupId, x.ApplicantUserId, x.IsDeparture })
            .IsUnique().HasFilter("\"Status\" IN ('Submitted', 'LeaderApproved', 'WithdrawalRequested')");
        b.Entity<Membership>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<Reservation>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<Venue>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<Event>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<AdministrativeRecord>().HasIndex(x => new { x.ActorUserId, x.OperationId }).IsUnique();
        b.Entity<AdministrativeChangeRequest>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<AdministrativeChangeRequest>().HasQueryFilter(x => _tenant.ActingRole == "SuperAdmin");
        b.Entity<AdministrativeRecord>().HasQueryFilter(x => _tenant.ActingRole == "SuperAdmin" ||
            (_tenant.ActingRole == "Archbishop" || _tenant.ActingRole == "ArchdioceseAdmin") && x.OrgId == _tenant.OrgId ||
            _tenant.ActingRole == "Priest" && _tenant.ParishIds.Contains(x.ParishId));
    }
}
