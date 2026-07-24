using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Constants;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Identity;

namespace ParishLive.Infrastructure.Data;

/// <summary>
/// Seeds one archdiocese, two parishes, two priests (one per parish) and a notice per parish.
/// Idempotent. Runs with an archdiocese-admin tenant context so the SaveChanges guard permits the
/// cross-parish inserts; every seeded row still carries an explicit OrgId/ParishId.
/// </summary>
public static class AppDbSeeder
{
    public static async Task SeedAsync(
        DbContextOptions<AppDbContext> options,
        UserManager<ApplicationUser> users,
        bool ensureCreated = false)
    {
        var adminTenant = new StaticTenantContext(SeedIds.Org, new[] { SeedIds.ParishA, SeedIds.ParishB }, true);
        await using var db = new AppDbContext(options, adminTenant);

        if (ensureCreated)
            await db.Database.EnsureCreatedAsync();

        if (await db.Organizations.IgnoreQueryFilters().AnyAsync())
            return; // already seeded

        db.Organizations.Add(new Organization { Id = SeedIds.Org, Name = "Archdiocese of Beirut" });
        db.Parishes.Add(new Parish { Id = SeedIds.ParishA, OrgId = SeedIds.Org, Name = "St. George Parish" });
        db.Parishes.Add(new Parish { Id = SeedIds.ParishB, OrgId = SeedIds.Org, Name = "St. Elias Parish" });
        await db.SaveChangesAsync();

        var priestA = await EnsureUser(users, SeedIds.PriestAEmail, "Fr. Elias Khoury");
        var priestB = await EnsureUser(users, SeedIds.PriestBEmail, "Fr. Antoine Rahme");

        db.Memberships.Add(new Membership { UserId = priestA.Id, OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Role = SystemRole.Priest });
        db.Memberships.Add(new Membership { UserId = priestB.Id, OrgId = SeedIds.Org, ParishId = SeedIds.ParishB, Role = SystemRole.Priest });
        await db.SaveChangesAsync();

        db.Notices.Add(Notice.Create(SeedIds.Org, SeedIds.ParishA, "St. George — Assumption Mass schedule",
            "The schedule of Masses for the Feast of the Assumption has been published. Please review the times and share with your groups.",
            NoticePriority.High, NoticeAudience.Everyone, priestA.Id, null));
        db.Notices.Add(Notice.Create(SeedIds.Org, SeedIds.ParishB, "St. Elias — Youth camp registration",
            "Registration for the summer youth camp is now open to all members.",
            NoticePriority.Normal, NoticeAudience.Members, priestB.Id, null));
        await db.SaveChangesAsync();

        // --- Phase 2: groups + a multi-role member + a past committee term ---
        db.Groups.Add(new Group { Id = SeedIds.YouthGroup, OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Name = "Youth Group", Category = GroupCategory.Youth });
        db.Groups.Add(new Group { Id = SeedIds.Choir, OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Name = "Choir", Category = GroupCategory.Choir });
        db.Groups.Add(new Group { Id = SeedIds.FundraisingCommittee, OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Name = "Fundraising Committee", Category = GroupCategory.Fundraising });
        await db.SaveChangesAsync();

        // Rita holds three different roles across three groups at once — and one prior term kept in history.
        var rita = await EnsureUser(users, SeedIds.RitaEmail, "Rita Khoury");
        db.Memberships.Add(new Membership { UserId = rita.Id, OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Role = SystemRole.Member });
        db.GroupMembers.AddRange(
            new GroupMember { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, GroupId = SeedIds.YouthGroup, UserId = rita.Id, Role = CommitteeRole.President, StartDate = new DateOnly(2026, 1, 15) },
            new GroupMember { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, GroupId = SeedIds.Choir, UserId = rita.Id, Role = CommitteeRole.RegularMember, StartDate = new DateOnly(2025, 9, 1) },
            new GroupMember { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, GroupId = SeedIds.FundraisingCommittee, UserId = rita.Id, Role = CommitteeRole.Treasurer, StartDate = new DateOnly(2026, 6, 1) },
            new GroupMember { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, GroupId = SeedIds.YouthGroup, UserId = rita.Id, Role = CommitteeRole.Secretary, StartDate = new DateOnly(2023, 1, 10), EndDate = new DateOnly(2024, 12, 31) }
        );
        await db.SaveChangesAsync();

        await SeedReservationWorkflowAsync(db);
        await SeedRbacAsync(db);

        // A secretary, and a reservation already forwarded to the priest so the approval screen has real data.
        var secretary = await EnsureUser(users, SeedIds.SecretaryAEmail, "M. Haddad");
        db.Memberships.Add(new Membership { UserId = secretary.Id, OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Role = SystemRole.Secretary });
        await db.SaveChangesAsync();

        await SeedSampleReservationAsync(db, rita.Id, secretary.Id);
        await SeedEventsAsync(db, rita.Id);
    }

    private static async Task SeedEventsAsync(AppDbContext db, string memberUserId)
    {
        var hall = await db.Venues.FirstOrDefaultAsync(v => v.Name == "Parish Hall");
        var venueId = hall?.Id;

        db.Events.AddRange(
            Event.Create(SeedIds.Org, SeedIds.ParishA, "Feast of the Assumption — Mass",
                "Solemn Mass for the Assumption of the Blessed Virgin Mary, followed by a procession.",
                null, venueId, new DateTimeOffset(2026, 8, 15, 10, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 8, 15, 11, 30, 0, TimeSpan.Zero), null, EventVisibility.Everyone, registrationOpen: false),
            Event.Create(SeedIds.Org, SeedIds.ParishA, "Youth Summer Camp",
                "Three-day summer camp for the youth group in the mountains.",
                SeedIds.YouthGroup, null, new DateTimeOffset(2026, 8, 20, 8, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 8, 22, 18, 0, 0, TimeSpan.Zero), 40, EventVisibility.Members, registrationOpen: true),
            Event.Create(SeedIds.Org, SeedIds.ParishA, "Choir Rehearsal",
                "Weekly rehearsal ahead of the Assumption liturgy.",
                SeedIds.Choir, venueId, new DateTimeOffset(2026, 8, 8, 19, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 8, 8, 21, 0, 0, TimeSpan.Zero), null, EventVisibility.Members, registrationOpen: false));
        await db.SaveChangesAsync();

        // One seeded registration for the camp.
        var camp = await db.Events.FirstAsync(e => e.Title == "Youth Summer Camp");
        db.EventRegistrations.Add(EventRegistration.Create(SeedIds.Org, SeedIds.ParishA, camp.Id, memberUserId));
        await db.SaveChangesAsync();
    }

    private static async Task SeedSampleReservationAsync(AppDbContext db, string requesterUserId, string secretaryUserId)
    {
        var hall = Venue.Create(SeedIds.Org, SeedIds.ParishA, "Parish Hall", 120);
        db.Venues.Add(hall);
        await db.SaveChangesAsync();

        var def = await db.WorkflowDefinitions.FirstAsync(d => d.Code == "reservation-default");
        var initial = await db.WorkflowStates.FirstAsync(s => s.WorkflowDefinitionId == def.Id && s.IsInitial);

        var reservation = Reservation.Create(
            SeedIds.Org, SeedIds.ParishA, SeedIds.YouthGroup, hall.Id, requesterUserId,
            "Youth Group — Fundraising dinner",
            "Annual youth fundraising dinner for the summer camp. Tables for 80, a small stage for speeches.",
            new DateTimeOffset(2026, 7, 25, 18, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 7, 25, 22, 0, 0, TimeSpan.Zero),
            80, def.Id, initial.Id);
        db.Reservations.Add(reservation);

        await ApplyByActionAsync(db, reservation, "SubmitForReview", requesterUserId, null);
        await ApplyByActionAsync(db, reservation, "Forward", secretaryUserId, null);
        await db.SaveChangesAsync();

        // Mirror the two seeded transitions into the audit trail so the log has demo content on a fresh boot.
        db.AuditLogs.AddRange(
            AuditLog.Create(SeedIds.Org, SeedIds.ParishA, requesterUserId, "reservation.SubmitForReview",
                "Reservation", reservation.Id, $"Submit for review: {reservation.Title}"),
            AuditLog.Create(SeedIds.Org, SeedIds.ParishA, secretaryUserId, "reservation.Forward",
                "Reservation", reservation.Id, $"Forward to priest: {reservation.Title}"));
        await db.SaveChangesAsync();
    }

    private static async Task ApplyByActionAsync(AppDbContext db, Reservation reservation, string actionCode, string actorUserId, string? note)
    {
        var transition = await db.WorkflowTransitions.FirstAsync(t =>
            t.WorkflowDefinitionId == reservation.WorkflowDefinitionId &&
            t.FromStateId == reservation.CurrentStateId &&
            t.ActionCode == actionCode);

        db.ReservationStateHistory.Add(reservation.ApplyTransition(transition, actorUserId, note));
    }

    /// <summary>
    /// Seeds the permission catalogue and the default archdiocese-wide roles with their grants. The
    /// secretary deliberately gets <c>reservations.review</c> but NOT <c>reservations.approve</c> — the
    /// spec's "secretary does not inherit the priest's permissions", enforced by data.
    /// </summary>
    private static async Task SeedRbacAsync(AppDbContext db)
    {
        (string Code, string Name)[] catalogue =
        [
            (PermissionCodes.Members.View, "View members"),
            (PermissionCodes.Members.Manage, "Manage members"),
            (PermissionCodes.Members.AssignRoles, "Assign roles"),
            (PermissionCodes.Groups.View, "View groups"),
            (PermissionCodes.Groups.Manage, "Manage groups"),
            (PermissionCodes.Reservations.Create, "Create reservations"),
            (PermissionCodes.Reservations.View, "View reservations"),
            (PermissionCodes.Reservations.Review, "Review reservations"),
            (PermissionCodes.Reservations.Approve, "Approve reservations"),
            (PermissionCodes.Reservations.Manage, "Manage reservations"),
            (PermissionCodes.Events.View, "View events"),
            (PermissionCodes.Events.Manage, "Manage events"),
            (PermissionCodes.Events.Register, "Register for events"),
            (PermissionCodes.Notices.View, "View notices"),
            (PermissionCodes.Notices.Publish, "Publish notices"),
            (PermissionCodes.Reports.View, "View reports"),
            (PermissionCodes.Reports.Export, "Export reports"),
            (PermissionCodes.Audit.View, "View the audit log")
        ];

        var permissions = catalogue.Select(p => Permission.Create(p.Code, p.Name)).ToList();
        db.Permissions.AddRange(permissions);
        await db.SaveChangesAsync();
        var byCode = permissions.ToDictionary(p => p.Code, p => p.Id);

        var priest = Role.Create(null, RoleCodes.Priest, "Parish Priest");
        var secretary = Role.Create(null, RoleCodes.Secretary, "Secretary");
        var member = Role.Create(null, RoleCodes.Member, "Member");
        db.ParishRoles.AddRange(priest, secretary, member);
        await db.SaveChangesAsync();

        void Grant(Role role, params string[] codes)
        {
            foreach (var code in codes)
                db.RolePermissions.Add(RolePermission.Create(role.Id, byCode[code]));
        }

        Grant(priest, catalogue.Select(p => p.Code).ToArray()); // full parish control
        Grant(secretary,
            PermissionCodes.Members.View, PermissionCodes.Groups.View,
            PermissionCodes.Reservations.Create, PermissionCodes.Reservations.View, PermissionCodes.Reservations.Review,
            PermissionCodes.Events.View, PermissionCodes.Notices.View, PermissionCodes.Notices.Publish);
        Grant(member,
            PermissionCodes.Reservations.Create, PermissionCodes.Reservations.View,
            PermissionCodes.Events.View, PermissionCodes.Events.Register,
            PermissionCodes.Groups.View, PermissionCodes.Notices.View);
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Seeds the default, archdiocese-wide reservation approval workflow as data. Because the chain is
    /// stored (states + transitions), a parish can add approval levels without code changes. Rejections
    /// require a note — enforced here as a transition flag, not a hard-coded rule.
    /// </summary>
    private static async Task SeedReservationWorkflowAsync(AppDbContext db)
    {
        var def = WorkflowDefinition.Create(
            parishId: null, code: "reservation-default", name: "Parish reservation approval",
            entityType: WorkflowEntityType.Reservation, version: 1, isActive: true);
        db.WorkflowDefinitions.Add(def);
        await db.SaveChangesAsync();

        var states = new[]
        {
            WorkflowState.Create(def.Id, "Submitted", "Submitted", 1, isInitial: true, isTerminal: false),
            WorkflowState.Create(def.Id, "UnderSecretaryReview", "Under secretary review", 2, false, false),
            WorkflowState.Create(def.Id, "ForwardedToPriest", "Forwarded to priest", 3, false, false),
            WorkflowState.Create(def.Id, "Approved", "Approved", 4, false, isTerminal: true),
            WorkflowState.Create(def.Id, "Rejected", "Rejected", 5, false, isTerminal: true)
        };
        db.WorkflowStates.AddRange(states);
        await db.SaveChangesAsync();

        Guid State(string code) => states.First(s => s.Code == code).Id;

        db.WorkflowTransitions.AddRange(
            WorkflowTransition.Create(def.Id, State("Submitted"), State("UnderSecretaryReview"),
                "SubmitForReview", "Submit for review", "reservations.create", requiresNote: false, isActive: true),
            WorkflowTransition.Create(def.Id, State("UnderSecretaryReview"), State("ForwardedToPriest"),
                "Forward", "Forward to priest", "reservations.review", false, true),
            WorkflowTransition.Create(def.Id, State("UnderSecretaryReview"), State("Submitted"),
                "ReturnForCorrection", "Return for correction", "reservations.review", requiresNote: true, isActive: true),
            WorkflowTransition.Create(def.Id, State("ForwardedToPriest"), State("Approved"),
                "Approve", "Approve", "reservations.approve", false, true),
            WorkflowTransition.Create(def.Id, State("ForwardedToPriest"), State("Rejected"),
                "Reject", "Reject", "reservations.approve", requiresNote: true, isActive: true)
        );
        await db.SaveChangesAsync();
    }

    private static async Task<ApplicationUser> EnsureUser(UserManager<ApplicationUser> users, string email, string displayName)
    {
        var existing = await users.FindByEmailAsync(email);
        if (existing is not null) return existing;

        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = displayName };
        var result = await users.CreateAsync(user, SeedIds.DemoPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException("Seed user creation failed: " + string.Join("; ", result.Errors.Select(e => e.Description)));
        return user;
    }
}
