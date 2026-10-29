using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Application.Operations;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using ParishLive.Infrastructure.Operations;
using Xunit;

namespace ParishLive.IntegrationTests;

public sealed class ReviewedRequirementsTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory factory;
    public ReviewedRequirementsTests(TestAppFactory factory) { this.factory = factory; _ = factory.Services; }

    private async Task<string> UserAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByEmailAsync(email))!.Id;
    }

    private AppDbContext Context(string? user = null, SystemRole? role = null, Guid? assignment = null, Guid? parish = null)
        => new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(factory.Connection).Options,
            new StaticTenantContext(SeedIds.Org, [parish ?? SeedIds.ParishA], user is null, user)
            { ActingRole = role?.ToString(), ActingAssignmentId = assignment });

    private ITenantContext Tenant(string user, SystemRole role, Guid? assignment = null, Guid? parish = null)
        => new StaticTenantContext(SeedIds.Org, [parish ?? SeedIds.ParishA], false, user)
        { ActingRole = role.ToString(), ActingAssignmentId = assignment };

    private ParishCaseService Cases(AppDbContext db, ITenantContext tenant) => new(db, tenant, new OperationalAccess(db, tenant), new OperationRunner(db, tenant));
    private DocumentService Documents(AppDbContext db, ITenantContext tenant) => new(db, tenant, new OperationalAccess(db, tenant), new OperationRunner(db, tenant));
    private FinanceService Finance(AppDbContext db, ITenantContext tenant) => new(db, tenant, new OperationalAccess(db, tenant), new OperationRunner(db, tenant));
    private CommunityService Community(AppDbContext db, ITenantContext tenant) => new(db, tenant, new OperationalAccess(db, tenant), new OperationRunner(db, tenant));

    private async Task<Guid> AddRoleAsync(string user, SystemRole role, Guid? group = null)
    {
        await using var db = Context();
        var existing = await db.Memberships.SingleOrDefaultAsync(m => m.UserId == user && m.Role == role &&
            m.ParishId == SeedIds.ParishA && m.GroupId == group);
        if (existing is not null) return existing.Id;
        var row = new Membership { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, UserId = user, Role = role, GroupId = group };
        db.Memberships.Add(row); await db.SaveChangesAsync(); return row.Id;
    }

    private async Task PolicyAsync()
    {
        await using var db = Context();
        var row = await db.ParishPolicies.SingleOrDefaultAsync();
        if (row is null) { row = new ParishPolicy { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA }; db.ParishPolicies.Add(row); }
        row.ApprovalReference = "FICTIONAL-TEST-POLICY"; row.ReligiousRequirementsApproved = true;
        row.OfficialTemplatesApproved = true; row.FinancePolicyApproved = true; row.SafeguardingPolicyApproved = true;
        row.RegisterSeries = "TEST-REGISTER"; row.RequiredEvidenceJson = "[\"birth\"]";
        row.SafeguardingLeadUserId = await UserAsync(SeedIds.PriestAEmail);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Secretary_records_genuine_prior_instruction_effectively_once_with_both_identities()
    {
        var secretary = await UserAsync(SeedIds.SecretaryAEmail); var priest = await UserAsync(SeedIds.PriestAEmail);
        var tenant = Tenant(secretary, SystemRole.Secretary);
        await using var db = Context(secretary, SystemRole.Secretary);
        var service = Cases(db, tenant);
        var created = await service.CreateAsync(new NewCase(SeedIds.ParishA, ServiceKind.Baptism, "Fictional subject", "ar", "{}", true, Guid.NewGuid()));
        var operation = Guid.NewGuid();
        var input = new CaseDecision(created.Id, 1, operation, "Accept", PriestUserId: priest,
            PriorInstructionConfirmed: true, InternalNote: "Fictional actual prior telephone instruction", InstructionChannel: "Telephone");
        await service.DecideAsync(input);
        var replay = await service.DecideAsync(input);
        Assert.True(replay.Replayed);
        var record = await db.ServiceCases.SingleAsync(c => c.Id == created.Id);
        Assert.Equal(CaseStage.Preparation, record.Stage);
        Assert.Equal(priest, record.ResponsiblePriestUserId);
        var history = await db.CaseHistories.SingleAsync(h => h.CaseId == created.Id && h.Action == "Accept");
        Assert.Equal(secretary, history.ActorUserId); Assert.Equal(priest, history.AuthorityUserId);
        Assert.Equal(1, await db.AccountNotifications.IgnoreQueryFilters().CountAsync(n => n.OperationId == operation && n.MessageCode == "M03"));
    }

    [Fact]
    public async Task Priest_direct_acceptance_does_not_fabricate_office_review_or_verify_missing_evidence()
    {
        await PolicyAsync(); var priest = await UserAsync(SeedIds.PriestAEmail); var tenant = Tenant(priest, SystemRole.Priest);
        await using var db = Context(priest, SystemRole.Priest); var service = Cases(db, tenant);
        var created = await service.CreateAsync(new NewCase(SeedIds.ParishA, ServiceKind.Baptism, "Fictional child", "fr", "{}", true, Guid.NewGuid()));
        await service.DecideAsync(new CaseDecision(created.Id, 1, Guid.NewGuid(), "Accept"));
        Assert.Equal(2, await db.CaseHistories.CountAsync(h => h.CaseId == created.Id));
        await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(new CaseDecision(created.Id, 2, Guid.NewGuid(), "Schedule", ActualAtUtc: DateTimeOffset.UtcNow.AddDays(7))));
        Assert.Empty(await db.CaseEvidence.Where(e => e.CaseId == created.Id).ToListAsync());
    }

    [Fact]
    public async Task Preparation_admin_cannot_use_secretary_proxy_and_cross_parish_priest_is_rejected()
    {
        var secretary = await UserAsync(SeedIds.SecretaryAEmail); var otherPriest = await UserAsync(SeedIds.PriestBEmail);
        var assignment = await AddRoleAsync(secretary, SystemRole.ParishAdmin);
        var adminTenant = Tenant(secretary, SystemRole.ParishAdmin, assignment);
        await using var db = Context(secretary, SystemRole.ParishAdmin, assignment); var service = Cases(db, adminTenant);
        var created = await service.CreateAsync(new NewCase(SeedIds.ParishA, ServiceKind.Baptism, "Fictional subject", "en", "{}", true, Guid.NewGuid()));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.DecideAsync(new CaseDecision(created.Id, 1, Guid.NewGuid(), "Accept",
            PriestUserId: otherPriest, PriorInstructionConfirmed: true, InternalNote: "Claim", InstructionChannel: "Telephone")));
        await using var secretaryDb = Context(secretary, SystemRole.Secretary);
        var original = await secretaryDb.Memberships.SingleAsync(m => m.UserId == secretary && m.Role == SystemRole.Secretary);
        var secretaryService = Cases(secretaryDb, Tenant(secretary, SystemRole.Secretary, original.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() => secretaryService.DecideAsync(new CaseDecision(created.Id, 1, Guid.NewGuid(), "Accept",
            PriestUserId: otherPriest, PriorInstructionConfirmed: true, InternalNote: "Claim", InstructionChannel: "Telephone")));
    }

    [Fact]
    public async Task Reusing_operation_id_with_a_changed_payload_is_refused()
    {
        var priest = await UserAsync(SeedIds.PriestAEmail); await using var db = Context(priest, SystemRole.Priest);
        var service = Cases(db, Tenant(priest, SystemRole.Priest)); var operation = Guid.NewGuid();
        var input = new NewCase(SeedIds.ParishA, ServiceKind.General, "Original", "en", "{}", true, operation);
        var first = await service.CreateAsync(input);
        var same = await service.CreateAsync(input); Assert.Equal(first.Id, same.Id);
        await Assert.ThrowsAsync<DomainException>(() => service.CreateAsync(input with { SubjectName = "Different" }));
    }

    [Fact]
    public async Task Stale_case_decision_cannot_overwrite_newer_state()
    {
        var priest = await UserAsync(SeedIds.PriestAEmail); await using var db = Context(priest, SystemRole.Priest);
        var service = Cases(db, Tenant(priest, SystemRole.Priest));
        var created = await service.CreateAsync(new NewCase(SeedIds.ParishA, ServiceKind.General, "Concurrency", "en", "{}", true, Guid.NewGuid()));
        await service.DecideAsync(new CaseDecision(created.Id, 1, Guid.NewGuid(), "Accept"));
        await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(new CaseDecision(created.Id, 1, Guid.NewGuid(), "Cancel", ApplicantMessage: "stale")));
        Assert.Equal(CaseStage.Preparation, (await service.GetAsync(created.Id))!.Stage);
    }

    [Fact]
    public async Task Cross_parish_case_and_private_instruction_are_not_visible_to_another_actor()
    {
        var priest = await UserAsync(SeedIds.PriestAEmail); await using var db = Context(priest, SystemRole.Priest);
        var created = await Cases(db, Tenant(priest, SystemRole.Priest)).CreateAsync(new NewCase(SeedIds.ParishA, ServiceKind.General, "Private", "en", "{}", true, Guid.NewGuid()));
        var other = await UserAsync(SeedIds.PriestBEmail); await using var otherDb = Context(other, SystemRole.Priest, parish: SeedIds.ParishB);
        Assert.Null(await Cases(otherDb, Tenant(other, SystemRole.Priest, parish: SeedIds.ParishB)).GetAsync(created.Id));
    }

    [Fact]
    public async Task Financial_viewer_is_read_only_and_submitter_cannot_independently_approve()
    {
        await PolicyAsync(); var first = await UserAsync(SeedIds.PriestAEmail); var second = await UserAsync(SeedIds.RitaEmail);
        var operatorAssignment = await AddRoleAsync(first, SystemRole.Treasurer); var viewerAssignment = await AddRoleAsync(second, SystemRole.FinanceViewer);
        await using var db = Context(first, SystemRole.Treasurer, operatorAssignment);
        var finance = Finance(db, Tenant(first, SystemRole.Treasurer, operatorAssignment));
        var request = await finance.SubmitAsync(new MoneyCommand(SeedIds.ParishA, MovementKind.Expense, 30, "USD", "ParishCash", null, "TestFund", Guid.NewGuid().ToString(), Guid.NewGuid()));
        await Assert.ThrowsAsync<DomainException>(() => finance.ApproveAsync(request.Id, 1, Guid.NewGuid()));
        await using var viewerDb = Context(second, SystemRole.FinanceViewer, viewerAssignment);
        var viewer = Finance(viewerDb, Tenant(second, SystemRole.FinanceViewer, viewerAssignment));
        await viewer.SummaryAsync(SeedIds.ParishA);
        await Assert.ThrowsAsync<ForbiddenException>(() => viewer.ApproveAsync(request.Id, 1, Guid.NewGuid()));
    }

    [Fact]
    public async Task Office_allowance_transfer_is_not_an_expense_and_original_currency_is_preserved()
    {
        await PolicyAsync(); var first = await UserAsync(SeedIds.PriestAEmail); var second = await UserAsync(SeedIds.PriestBEmail);
        var a = await AddRoleAsync(first, SystemRole.Treasurer); var b = await AddRoleAsync(second, SystemRole.Treasurer);
        async Task Post(MovementKind kind, decimal amount, string account, string? destination)
        {
            Guid id;
            await using (var one = Context(first, SystemRole.Treasurer, a))
                id = (await Finance(one, Tenant(first, SystemRole.Treasurer, a)).SubmitAsync(new MoneyCommand(SeedIds.ParishA, kind,
                    amount, "USD", account, destination, "TestFund", Guid.NewGuid().ToString(), Guid.NewGuid()))).Id;
            await using (var two = Context(second, SystemRole.Treasurer, b))
                await Finance(two, Tenant(second, SystemRole.Treasurer, b)).ApproveAsync(id, 1, Guid.NewGuid());
            await using (var three = Context(first, SystemRole.Treasurer, a))
                await Finance(three, Tenant(first, SystemRole.Treasurer, a)).PayAsync(id, 2, "Fictional test receipt", DateTimeOffset.UtcNow, Guid.NewGuid());
        }
        await Post(MovementKind.Opening, 1000, "TestBank", null);
        await Post(MovementKind.Transfer, 100, "TestBank", "OfficeCash");
        await Post(MovementKind.Expense, 30, "OfficeCash", null);
        await using var read = Context(first, SystemRole.Treasurer, a);
        var summary = await Finance(read, Tenant(first, SystemRole.Treasurer, a)).SummaryAsync(SeedIds.ParishA);
        Assert.Equal(90000, summary.Balances["TestBank/USD"]); Assert.Equal(7000, summary.Balances["OfficeCash/USD"]);
        Assert.Equal(3000, summary.Expenses["USD"]);
        Assert.Equal(900000, FinanceService.MinorUnits(900000m, "LBP"));
        Assert.Throws<DomainException>(() => FinanceService.MinorUnits(1.5m, "LBP"));
    }

    [Fact]
    public async Task Closed_giving_needs_actual_distinct_review_and_posts_once()
    {
        await PolicyAsync(); var first = await UserAsync(SeedIds.SecretaryAEmail); var second = await UserAsync(SeedIds.RitaEmail);
        var a = await AddRoleAsync(first, SystemRole.Treasurer); var b = await AddRoleAsync(second, SystemRole.Treasurer);
        Guid id;
        await using (var db = Context(first, SystemRole.Treasurer, a))
        {
            var service = Finance(db, Tenant(first, SystemRole.Treasurer, a));
            id = (await service.OpenCountAsync(SeedIds.ParishA, "Test collection", Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(-1))).Id;
            await service.AddCountLineAsync(id, 1, 100, "USD", "TestFund", Guid.NewGuid());
            await Assert.ThrowsAsync<DomainException>(() => service.CloseCountAsync(id, 2, Guid.NewGuid()));
        }
        await using (var db = Context(second, SystemRole.Treasurer, b))
        {
            var service = Finance(db, Tenant(second, SystemRole.Treasurer, b));
            await service.VerifyCountAsync(id, 2, new Dictionary<string, long> { ["USD"] = 9500 }, Guid.NewGuid());
            Assert.Equal("Variance", (await db.GivingBatches.SingleAsync(x => x.Id == id)).Status);
            await service.VerifyCountAsync(id, 3, new Dictionary<string, long> { ["USD"] = 10000 }, Guid.NewGuid());
            var operation = Guid.NewGuid(); await service.CloseCountAsync(id, 4, operation); await service.CloseCountAsync(id, 4, operation);
            Assert.Equal(1, await db.GivingLines.CountAsync(l => l.BatchId == id && l.MovementId != null));
            await Assert.ThrowsAsync<DomainException>(() => service.AddCountLineAsync(id, 5, 1, "USD", "TestFund", Guid.NewGuid()));
        }
    }

    [Fact]
    public async Task Missing_translation_and_stale_draft_do_not_unpublish_live_revision()
    {
        var priest = await UserAsync(SeedIds.PriestAEmail); await using var db = Context(priest, SystemRole.Priest);
        var service = Community(db, Tenant(priest, SystemRole.Priest));
        var all = new Dictionary<string, string> { ["en"] = "Public", ["fr"] = "Public", ["ar"] = "عام" };
        var page = await service.SaveContentAsync(SeedIds.ParishA, null, 0, Guid.NewGuid().ToString(), all, Guid.NewGuid());
        await service.PublishContentAsync(page.Id, 1, Guid.NewGuid());
        await service.SaveContentAsync(SeedIds.ParishA, page.Id, 2, "unchanged", new Dictionary<string, string> { ["en"] = "Draft" }, Guid.NewGuid());
        await Assert.ThrowsAsync<DomainException>(() => service.PublishContentAsync(page.Id, 3, Guid.NewGuid()));
        Assert.Equal(JsonSerializer.Serialize(all), (await db.ContentPages.SingleAsync(c => c.Id == page.Id)).PublishedJson);
        await Assert.ThrowsAsync<DomainException>(() => service.SaveContentAsync(SeedIds.ParishA, page.Id, 1, "stale", all, Guid.NewGuid()));
    }

    [Fact]
    public async Task Financial_history_cannot_be_deleted_through_alternate_save_overload()
    {
        await using var db = Context();
        var movement = new LedgerMovement { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Units = 1, Currency = "USD",
            Account = "Test", Fund = "Test", SourceReference = Guid.NewGuid().ToString(), ActorUserId = "TEST" };
        db.LedgerMovements.Add(movement); await db.SaveChangesAsync(); db.LedgerMovements.Remove(movement);
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync(true));
    }
}
