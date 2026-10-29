using System.Net;
using System.Text;
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

public sealed class AccessAndRecoveryTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory factory;
    private readonly DbContextOptions<AppDbContext> options;
    public AccessAndRecoveryTests(TestAppFactory factory)
    {
        this.factory = factory; _ = factory.Services;
        options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(factory.Connection).Options;
    }
    private async Task<string> User(string email)
    {
        using var scope = factory.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByEmailAsync(email))!.Id;
    }
    private StaticTenantContext Tenant(string? user = null, SystemRole? role = null, Guid? assignment = null) =>
        new(SeedIds.Org, [SeedIds.ParishA], user is null, user) { ActingRole = role?.ToString(), ActingAssignmentId = assignment };
    private AppDbContext Db(ITenantContext? tenant = null) => new(options, tenant ?? Tenant());
    private ParishCaseService Cases(AppDbContext db, ITenantContext tenant) => new(db, tenant, new(db, tenant), new(db, tenant));
    private DocumentService Documents(AppDbContext db, ITenantContext tenant) => new(db, tenant, new(db, tenant), new(db, tenant));
    private PrivateWorkService Private(AppDbContext db, ITenantContext tenant) => new(db, tenant, new(db, tenant), new(db, tenant));
    private async Task<ParishPolicy> Policy()
    {
        await using var db = Db();
        var policy = await db.ParishPolicies.SingleOrDefaultAsync() ?? new ParishPolicy { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA };
        if (db.Entry(policy).State == EntityState.Detached) db.Add(policy);
        policy.ReligiousRequirementsApproved = true; policy.OfficialTemplatesApproved = true;
        policy.RequiredEvidenceJson = "[]"; policy.RegisterSeries = "FICTIONAL-TEST";
        policy.SafeguardingPolicyApproved = true; policy.SafeguardingLeadUserId = await User(SeedIds.PriestAEmail);
        await db.SaveChangesAsync(); return policy;
    }
    [Fact]
    public async Task Guest_retry_association_and_revocation_preserve_one_original_request_without_membership()
    {
        var priest = await User(SeedIds.PriestAEmail); var applicant = await User(SeedIds.PriestBEmail);
        var tenant = Tenant(priest, SystemRole.Priest);
        await using var db = Db(tenant); var guests = new GuestIntakeService(options);
        var parish = await db.Parishes.SingleAsync(p => p.Id == SeedIds.ParishA);
        parish.PubliclyListed = true; await db.SaveChangesAsync();
        await guests.ConfigureAsync(db, tenant, parish.Id, true, [ServiceKind.Baptism], "FICTIONAL-INTAKE-APPROVAL", true, Guid.NewGuid());
        var secret = GuestIntakeService.NewSecret();
        var input = new GuestRequest(parish.Id, ServiceKind.Baptism, "Fictional guest child", "Fictional office contact",
            "Applicant supplied details", "ar", secret, Guid.NewGuid());
        var first = await guests.SubmitAsync(input); var retry = await guests.SubmitAsync(input);
        Assert.Equal(first.Id, retry.Id);
        var original = await db.ServiceCases.SingleAsync(c => c.Id == first.Id);
        Assert.Equal("Guest", original.Origin); Assert.StartsWith("guest:", original.RequesterUserId);
        Assert.DoesNotContain(secret, (await db.GuestAccess.SingleAsync(g => g.CaseId == first.Id)).TokenHash);
        Assert.Empty(await db.People.Where(p => p.SuppliedName == input.SubjectName).ToListAsync());
        var before = await db.Memberships.IgnoreQueryFilters().CountAsync(m => m.UserId == applicant);
        await guests.AssociateAsync(db, tenant, first.Id, SeedIds.PriestBEmail, "FICTIONAL-REQUESTER-IDENTITY-REVIEW", Guid.NewGuid());
        Assert.Null(await guests.StatusAsync(secret));
        Assert.Equal(before, await db.Memberships.IgnoreQueryFilters().CountAsync(m => m.UserId == applicant));
        var applicantTenant = new StaticTenantContext(Guid.Empty, [], false, applicant);
        await using var ownDb = Db(applicantTenant);
        Assert.Equal(first.Reference, (await Cases(ownDb, applicantTenant).GetAsync(first.Id))!.Reference);
    }
    [Fact]
    public async Task Following_two_parishes_and_primary_is_independent_of_membership_and_person_links()
    {
        var user = await User(SeedIds.RitaEmail); var tenant = new StaticTenantContext(Guid.Empty, [], false, user);
        await using (var setup = Db())
        {
            foreach (var parish in await setup.Parishes.IgnoreQueryFilters().Where(p => p.Id == SeedIds.ParishA || p.Id == SeedIds.ParishB).ToListAsync()) parish.PubliclyListed = true;
            await setup.SaveChangesAsync();
        }
        await using var db = Db(tenant); var service = new FollowingService(db, tenant, new(db, tenant));
        var memberships = await db.Memberships.IgnoreQueryFilters().CountAsync(m => m.UserId == user);
        var operation = Guid.NewGuid(); await service.SetAsync(SeedIds.ParishA, true, true, operation);
        await service.SetAsync(SeedIds.ParishA, true, true, operation);
        await service.SetAsync(SeedIds.ParishB, true, false, Guid.NewGuid());
        Assert.Equal(2, await db.ParishFollows.CountAsync());
        Assert.Equal(SeedIds.ParishA, (await db.ParishFollows.SingleAsync(f => f.IsPrimary)).ParishId);
        await service.SetAsync(SeedIds.ParishB, true, true, Guid.NewGuid());
        Assert.Single(await db.ParishFollows.Where(f => f.IsPrimary).ToListAsync());
        Assert.Equal(memberships, await db.Memberships.IgnoreQueryFilters().CountAsync(m => m.UserId == user));
    }
    [Fact]
    public async Task Unlinked_applicant_can_resume_own_draft_and_replace_rejected_evidence_without_other_case_access()
    {
        var applicant = await User(SeedIds.PriestBEmail); var tenant = new StaticTenantContext(Guid.Empty, [], false, applicant);
        await using (var setup = Db()) { var parish = await setup.Parishes.SingleAsync(p => p.Id == SeedIds.ParishA); parish.PubliclyListed = true; await setup.SaveChangesAsync(); }
        await using var db = Db(tenant); var cases = Cases(db, tenant); var docs = Documents(db, tenant);
        var created = await cases.CreateAsync(new(SeedIds.ParishA, ServiceKind.Baptism, "Unknown script name", "ar", "{}", false, Guid.NewGuid()));
        var saved = await cases.SaveDraftAsync(created.Id, 1, "Supplied Latin name", "{\"details\":\"النص محفوظ\"}", "fr", true, Guid.NewGuid());
        var first = await docs.UploadAsync(new(created.Id, saved.Revision, "birth", "test.pdf", "application/pdf", "%PDF-test"u8.ToArray(), null, Guid.NewGuid()));
        var priest = await User(SeedIds.PriestAEmail); var priestTenant = Tenant(priest, SystemRole.Priest);
        await using (var office = Db(priestTenant)) { await Documents(office, priestTenant).VerifyAsync(first.Id, 1, EvidenceStatus.Rejected, "Unreadable fictional copy", Guid.NewGuid()); }
        var view = await cases.GetAsync(created.Id); Assert.Contains("النص محفوظ", view!.FactsJson);
        var replacement = await docs.UploadAsync(new(created.Id, view.Revision, "birth", "replacement.pdf", "application/pdf", "%PDF-readable"u8.ToArray(), first.Id, Guid.NewGuid()));
        await using var check = Db();
        Assert.Equal(first.Id, (await check.CaseEvidence.SingleAsync(e => e.Id == replacement.Id)).ReplacesId);
        var other = new StaticTenantContext(Guid.Empty, [], false, await User(SeedIds.RitaEmail));
        await using var otherDb = Db(other); Assert.Null(await Cases(otherDb, other).GetAsync(created.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() => Documents(otherDb, other).UploadAsync(new(created.Id, view.Revision, "birth", "x.pdf", "application/pdf", "%PDF-x"u8.ToArray(), null, Guid.NewGuid())));
    }
    [Fact]
    public async Task Bishop_return_invalidates_signature_file_and_release_requires_exact_recipient_then_can_be_withdrawn()
    {
        await Policy(); var priest = await User(SeedIds.PriestAEmail); var tenant = Tenant(priest, SystemRole.Priest);
        var applicant = await User(SeedIds.RitaEmail); ServiceCase source;
        await using (var setup = Db())
        {
            source = new ServiceCase { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Reference = "TEST-" + Guid.NewGuid(),
                SubjectName = "Fictional registered subject", Stage = CaseStage.Registered, OfficialSnapshotJson = "{\"SubjectName\":\"Fictional registered subject\"}",
                RequesterUserId = applicant, ResponsiblePriestUserId = priest, ResponsiblePriestName = "Fictional priest" };
            setup.Add(source); await setup.SaveChangesAsync();
        }
        await using var db = Db(tenant); var service = Documents(db, tenant);
        var result = await service.PrepareCertificateAsync(source.Id, "ar", Guid.NewGuid());
        async Task<OperationResult> Act(string action, string? evidence = null, string? recipient = null) =>
            await service.ActAsync(new(result.Id, (await db.Certificates.SingleAsync(c => c.Id == result.Id)).Revision,
                Guid.NewGuid(), action, evidence, recipient, "FICTIONAL-VERIFIED-REPRESENTATION"));
        await Act("Approve"); await Act("RecordPaperSignature", "FICTIONAL-WET-SIGNATURE-1");
        var cert = await db.Certificates.SingleAsync(c => c.Id == result.Id);
        await Assert.ThrowsAsync<DomainException>(() => service.AttachFinalAsync(cert.Id, cert.Revision, Guid.NewGuid(), source.SubjectName, true, "final.pdf", "application/pdf", "%PDF-final"u8.ToArray(), Guid.NewGuid()));
        await service.AttachFinalAsync(cert.Id, cert.Revision, source.Id, source.SubjectName, true, "final.pdf", "application/pdf", "%PDF-final"u8.ToArray(), Guid.NewGuid());
        var bishop = await User(SeedIds.SecretaryAEmail);
        await using (var setup = Db()) { setup.Memberships.Add(new Membership { OrgId = SeedIds.Org, ParishId = Guid.Empty, Role = SystemRole.Archbishop, UserId = bishop }); await setup.SaveChangesAsync(); }
        var bishopTenant = new StaticTenantContext(SeedIds.Org, [], true, bishop) { ActingRole = "Archbishop" };
        await using (var review = Db(bishopTenant)) await Documents(review, bishopTenant).BishopReviewAsync(cert.Id, cert.Revision, false, "Fictional reviewed correction", Guid.NewGuid());
        db.ChangeTracker.Clear(); cert = await db.Certificates.SingleAsync(c => c.Id == result.Id);
        Assert.Null(cert.FinalContent); Assert.Null(cert.SignedEvidenceReference); Assert.Equal(2, cert.DocumentVersion);
        await Act("Approve"); await Act("RecordPaperSignature", "FICTIONAL-WET-SIGNATURE-2");
        await service.AttachFinalAsync(cert.Id, cert.Revision, source.Id, source.SubjectName, true, "corrected.pdf", "application/pdf", "%PDF-corrected"u8.ToArray(), Guid.NewGuid());
        await using (var review = Db(bishopTenant)) await Documents(review, bishopTenant).BishopReviewAsync(cert.Id, cert.Revision, true, "Reviewed exact version", Guid.NewGuid());
        db.ChangeTracker.Clear(); await Act("Issue"); await Act("Release", recipient: applicant);
        var owner = new StaticTenantContext(Guid.Empty, [], false, applicant); await using var ownerDb = Db(owner);
        Assert.NotNull(await Documents(ownerDb, owner).GetForRecipientAsync(cert.Id));
        var stranger = new StaticTenantContext(Guid.Empty, [], false, await User(SeedIds.PriestBEmail)); await using var strangerDb = Db(stranger);
        Assert.Null(await Documents(strangerDb, stranger).GetForRecipientAsync(cert.Id));
        await Act("WithdrawRelease", "Wrong-file report investigation");
        Assert.Null(await Documents(ownerDb, owner).GetForRecipientAsync(cert.Id));
    }
    [Fact]
    public async Task Anonymous_sensitive_concern_has_no_admin_count_and_confidential_identity_requires_separate_grant()
    {
        var submitter = await User(SeedIds.RitaEmail); var reviewer = await User(SeedIds.SecretaryAEmail);
        Guid assignment;
        await using (var setup = Db())
        {
            var role = new Membership { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Role = SystemRole.ConcernReviewer,
                UserId = reviewer, CanReviewSensitiveConcerns = true, CanViewConcernIdentity = true };
            assignment = role.Id; setup.Memberships.Add(role); await setup.SaveChangesAsync();
        }
        var author = Tenant(submitter, SystemRole.Member); await using var authorDb = Db(author);
        var result = await Private(authorDb, author).SubmitConcernAsync(SeedIds.ParishA, "Fictional sensitive concern", true, true, [reviewer], Guid.NewGuid());
        var reviewerTenant = Tenant(reviewer, SystemRole.ConcernReviewer, assignment); await using var reviewDb = Db(reviewerTenant);
        var view = Assert.Single(await Private(reviewDb, reviewerTenant).ConcernsAsync()); Assert.Equal(result.Id, view.Id); Assert.Null(view.SubmitterUserId);
        var admin = Tenant(await User(SeedIds.SecretaryAEmail), SystemRole.ArchdioceseAdmin); await using var adminDb = Db(admin);
        Assert.Equal(0, await adminDb.Concerns.CountAsync()); Assert.Empty(await Private(adminDb, admin).ConcernsAsync());
        var ownGrant = await reviewDb.ConcernAccess.SingleAsync(a => a.ConcernId == result.Id); ownGrant.Conflicted = true; await reviewDb.SaveChangesAsync();
        Assert.Equal(0, await reviewDb.Concerns.CountAsync());
    }
    [Fact]
    public async Task Private_pastoral_note_does_not_pass_to_a_new_priest_or_an_administrator()
    {
        var priest = await User(SeedIds.PriestAEmail); var tenant = Tenant(priest, SystemRole.Priest);
        await using var db = Db(tenant); var service = Private(db, tenant);
        var privateNote = await service.SaveNoteAsync(SeedIds.ParishA, null, 0, "Fictional private note", "Private narrative", "Author", null, false, Guid.NewGuid());
        var shared = await service.SaveNoteAsync(SeedIds.ParishA, null, 0, "Fictional shared task", "Permitted task", "CurrentPriests", null, true, Guid.NewGuid());
        var other = await User(SeedIds.PriestBEmail);
        Guid assignment;
        await using (var setup = Db()) { var role = new Membership { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Role = SystemRole.Priest, UserId = other }; assignment = role.Id; setup.Add(role); await setup.SaveChangesAsync(); }
        var replacement = Tenant(other, SystemRole.Priest, assignment); await using var nextDb = Db(replacement);
        var notes = await Private(nextDb, replacement).NotesAsync(); Assert.Contains(notes, n => n.Id == shared.Id); Assert.DoesNotContain(notes, n => n.Id == privateNote.Id);
        var admin = Tenant(await User(SeedIds.SecretaryAEmail), SystemRole.ArchdioceseAdmin); await using var adminDb = Db(admin);
        Assert.Empty(await Private(adminDb, admin).NotesAsync());
    }
    [Fact]
    public async Task Unknown_age_blocks_confirmation_and_unauthorized_collector_never_creates_an_exit()
    {
        await Policy(); var priest = await User(SeedIds.PriestAEmail); var tenant = Tenant(priest, SystemRole.Priest);
        await using var db = Db(tenant);
        var occurrence = Event.Create(SeedIds.Org, SeedIds.ParishA, "Fictional event", null, null, null,
            DateTimeOffset.UtcNow.AddMinutes(-30), DateTimeOffset.UtcNow.AddHours(1), 5, EventVisibility.Members, true);
        db.Events.Add(occurrence); await db.SaveChangesAsync();
        await using (var setup = Db()) { setup.Memberships.Add(new Membership { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, UserId = priest, Role = SystemRole.FinanceViewer }); await setup.SaveChangesAsync(); }
        var viewerTenant = Tenant(priest, SystemRole.FinanceViewer); await using var viewerDb = Db(viewerTenant);
        Assert.False(await new EventAdmissionService(viewerDb, viewerTenant, new(viewerDb, viewerTenant), new(viewerDb, viewerTenant)).CanOperateAsync(occurrence.Id));
        var service = new EventAdmissionService(db, tenant, new(db, tenant), new(db, tenant));
        var result = await service.ReserveAsync(occurrence.Id, priest, null, Guid.NewGuid());
        await Assert.ThrowsAsync<DomainException>(() => service.ConfirmAsync(result.Id, result.Revision, Guid.NewGuid()));
        await service.VerifyConsentAsync(result.Id, result.Revision, "Actual fictional reviewed consent", ["Fictional approved collector"], false, Guid.NewGuid(), new DateOnly(2015, 1, 1));
        var row = await db.EventAdmissions.SingleAsync(a => a.Id == result.Id);
        await service.ConfirmAsync(row.Id, row.Revision, Guid.NewGuid());
        await service.ArrivalAsync(row.Id, row.Revision, DateTimeOffset.UtcNow.AddMinutes(-5), Guid.NewGuid(), true, "FICTIONAL-PAPER-LOG");
        await Assert.ThrowsAsync<DomainException>(() => service.PickupAsync(row.Id, row.Revision, "Unauthorized visitor", "A reference is insufficient", false, Guid.NewGuid()));
        db.ChangeTracker.Clear(); row = await db.EventAdmissions.SingleAsync(a => a.Id == result.Id);
        Assert.Null(row.ExitedAtUtc); Assert.Single(await db.AttendanceMovements.Where(m => m.AdmissionId == row.Id).ToListAsync());
        await service.PickupAsync(row.Id, row.Revision, "Fictional approved collector", "FICTIONAL-IDENTITY-CHECK", false, Guid.NewGuid());
        Assert.NotNull(row.ExitedAtUtc);
    }
    [Fact]
    public async Task Live_role_revocation_removes_old_tab_access_and_three_languages_have_correct_document_direction()
    {
        var priest = await User(SeedIds.PriestAEmail); Guid assignment;
        await using (var setup = Db()) assignment = (await setup.Memberships.SingleAsync(m => m.UserId == priest && m.Role == SystemRole.Priest && m.ParishId == SeedIds.ParishA)).Id;
        var client = factory.CreateClient(); client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, priest);
        foreach (var language in new[] { "en", "fr", "ar" })
        {
            var response = await client.GetAsync($"/People/Records?actingAs={assignment}&culture={language}&ui-culture={language}");
            var html = await response.Content.ReadAsStringAsync(); Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains($"lang=\"{language}\"", html); Assert.Contains($"dir=\"{(language == "ar" ? "rtl" : "ltr")}\"", html);
        }
        await using (var setup = Db()) { var role = await setup.Memberships.SingleAsync(m => m.Id == assignment); role.IsActive = false; await setup.SaveChangesAsync(); }
        var denied = await client.GetStringAsync($"/People/Records?actingAs={assignment}");
        Assert.Contains("unavailable", denied, StringComparison.OrdinalIgnoreCase);
        await using (var setup = Db()) { var role = await setup.Memberships.SingleAsync(m => m.Id == assignment); role.IsActive = true; await setup.SaveChangesAsync(); }
        var csrf = await client.PostAsync($"/People/Records?actingAs={assignment}", new FormUrlEncodedContent(new Dictionary<string, string> { ["SuppliedName"] = "Injected" }));
        Assert.Equal(HttpStatusCode.BadRequest, csrf.StatusCode);
    }

    [Fact]
    public async Task Financial_viewer_export_is_scope_limited_and_escapes_spreadsheet_formulas()
    {
        var viewer = await User(SeedIds.PriestBEmail); Guid assignment;
        var source = "=FICTIONAL-UNTRUSTED-CELL";
        await using (var setup = Db())
        {
            var role = new Membership { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Role = SystemRole.FinanceViewer, UserId = viewer };
            setup.Memberships.Add(role); assignment = role.Id;
            setup.LedgerMovements.Add(new LedgerMovement { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA,
                Kind = MovementKind.Receipt, Units = 1250, Currency = "USD", Account = "Fictional account", Fund = "Fictional fund",
                SourceReference = source, ActorUserId = viewer, ActualAtUtc = DateTimeOffset.UtcNow });
            setup.LedgerMovements.Add(new LedgerMovement { OrgId = SeedIds.Org, ParishId = SeedIds.ParishB,
                Kind = MovementKind.Receipt, Units = 500, Currency = "USD", Account = "Other account", Fund = "Other fund",
                SourceReference = "OUTSIDE-PERMITTED-PARISH", ActorUserId = viewer, ActualAtUtc = DateTimeOffset.UtcNow });
            await setup.SaveChangesAsync();
        }
        var client = factory.CreateClient(); client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, viewer);
        var response = await client.GetAsync($"/Finance?handler=Export&actingAs={assignment}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode); Assert.Equal("text/csv", response.Content.Headers.ContentType!.MediaType);
        var csv = await response.Content.ReadAsStringAsync(); Assert.Contains("\"'=FICTIONAL-UNTRUSTED-CELL\"", csv);
        Assert.Contains("\"12.5\",\"USD\"", csv); Assert.DoesNotContain("OUTSIDE-PERMITTED-PARISH", csv);
        var tenant = Tenant(viewer, SystemRole.FinanceViewer, assignment); await using var db = Db(tenant);
        await Assert.ThrowsAsync<ForbiddenException>(() => new FinanceService(db, tenant, new(db, tenant), new(db, tenant)).ReceiveAsync(
            new(SeedIds.ParishA, MovementKind.Receipt, 1, "USD", "A", null, "F", "FORBIDDEN-WRITE", Guid.NewGuid()), "Cash", DateTimeOffset.UtcNow, new Dictionary<string, decimal>()));
    }

    [Fact]
    public async Task Configured_secretary_certificate_approval_records_instruction_but_cannot_sign()
    {
        await Policy(); var secretary = await User(SeedIds.SecretaryAEmail); var priest = await User(SeedIds.PriestAEmail);
        var tenant = Tenant(secretary, SystemRole.Secretary); Guid caseId;
        await using (var setup = Db())
        {
            var policy = await setup.ParishPolicies.SingleAsync(); policy.AllowProxyCertificateApproval = true;
            var record = new ServiceCase { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, Reference = "TEST-" + Guid.NewGuid(),
                RequesterUserId = secretary, SubjectName = "Fictional subject", Stage = CaseStage.Registered,
                OfficialSnapshotJson = "{\"SubjectName\":\"Fictional subject\"}" };
            setup.ServiceCases.Add(record); caseId = record.Id; await setup.SaveChangesAsync();
        }
        await using var db = Db(tenant); var service = Documents(db, tenant);
        var result = await service.PrepareCertificateAsync(caseId, "en", Guid.NewGuid());
        var command = new CertificateAction(result.Id, 1, Guid.NewGuid(), "Approve", "FICTIONAL-ACTUAL-PRIOR-INSTRUCTION",
            InstructingPriestUserId: priest, PriorInstructionConfirmed: true, InstructionChannel: "Telephone");
        await service.ActAsync(command); Assert.True((await service.ActAsync(command)).Replayed);
        var certificate = await db.Certificates.SingleAsync(c => c.Id == result.Id);
        Assert.Equal(priest, certificate.PriestUserId); Assert.Null(certificate.SignedEvidenceReference);
        await Assert.ThrowsAsync<ForbiddenException>(() => service.ActAsync(new(result.Id, certificate.Revision, Guid.NewGuid(), "RecordPaperSignature", "Cannot substitute signature")));
        var history = await db.CaseHistories.SingleAsync(h => h.CaseId == caseId && h.Action == "Certificate.Approve");
        Assert.Equal(secretary, history.ActorUserId); Assert.Equal(priest, history.AuthorityUserId);
        Assert.Equal(1, await db.AccountNotifications.IgnoreQueryFilters().CountAsync(n => n.OperationId == command.OperationId && n.MessageCode == "M03"));
    }

    [Fact]
    public void Extreme_or_fractional_money_is_a_validation_error_instead_of_overflow_or_rounding()
    {
        Assert.Throws<DomainException>(() => FinanceService.MinorUnits(decimal.MaxValue, "USD"));
        Assert.Throws<DomainException>(() => FinanceService.MinorUnits(0.001m, "USD"));
        Assert.Throws<DomainException>(() => FinanceService.MinorUnits(1.5m, "LBP"));
        Assert.Equal(1250L, FinanceService.MinorUnits(12.50m, "USD"));
    }
}
