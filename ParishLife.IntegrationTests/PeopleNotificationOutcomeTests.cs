// Purpose: verifies A10/A11/A12 source-linked notification outcomes through real isolated services and authenticated HTTP.
// Main tests: committed decisions survive notice failure, worker repair changes Pending to Stored, source authorization hides recipient/work details,
// invitation bearer tokens grant no diagnostics, and historical unknown tracking differs from a new action requiring no notice.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PeopleNotificationOutcomeTests
{
    [Fact]
    public async Task Membership_decision_remains_committed_with_a_pending_outcome_and_worker_repairs_only_its_notice()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, false);
        var submitted = await s.Service.RequestAsync(s.Parish, Apply(), default);
        Assert.Equal("NotRequired", submitted.NotificationOutcome?.Status);
        s.Office();
        var request = new MembershipDecisionDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Records.ReadAsync<MembershipRequest>(s.Scope, "membershipRequest:" + submitted.Id, default))!.Version,
            Action = "return", Reason = "Please clarify the supplied details."
        };
        var brokenNotices = ActivatorUtilities.CreateInstance<NotificationService>(f.Services, new FailedAccountWrites(s.Records));
        var service = ActivatorUtilities.CreateInstance<MembershipService>(f.Services, brokenNotices);
        var saved = await service.DecideAsync(s.Parish, submitted.Id, request, default);
        Assert.Equal(("NeedsInformation", "Pending"), (saved.Status, saved.NotificationOutcome?.Status));
        var row = (await s.Records.ReadAsync<MembershipRequest>(s.Scope, "membershipRequest:" + submitted.Id, default))!;
        var workId = Assert.Single(row.Value.NotificationWorkIds!);
        Assert.Equal("Pending", (await s.Records.ReadAsync<NotificationWork>(s.Scope, "notificationWork:" + workId, default))!.Value.Status);
        f.As(applicant, false);
        Assert.Equal("Pending", (await s.Service.MembershipNotificationOutcomeAsync(s.Parish, submitted.Id, default)).Status);
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(s.Parish, workId, default);
        Assert.Equal("Stored", (await s.Service.MembershipNotificationOutcomeAsync(s.Parish, submitted.Id, default)).Status);
        Assert.Equal(row.Version, (await s.Records.ReadAsync<MembershipRequest>(s.Scope, "membershipRequest:" + submitted.Id, default))!.Version);
        Assert.Single((await s.Records.PageAsync<Notification>(Account(applicant), "notification", 100, null, default)).Items);
        Assert.Null(Assert.Single(await s.Service.OwnRequestsAsync(s.Parish, default)).NotificationOutcome);
    }

    [Fact]
    public async Task Correction_review_keeps_applied_person_changes_and_replay_reads_current_notification_outcome()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        var person = await s.PersonAsync("Correction subject");
        s.Office();
        await f.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(s.Parish, new LinkMinistryPersonDto
        { OperationId = Guid.NewGuid(), AccountId = Guid.Parse(applicant), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity" }, default);
        f.As(applicant, false);
        var proposed = await s.Service.ProposeCorrectionAsync(s.Parish, new ProposeProfileCorrectionDto
        { OperationId = Guid.NewGuid(), Fields = [new ProfileCorrectionFieldDto { Field = "Contact", NewValue = "updated@fixture.example" }] }, default);
        Assert.Equal("NotRequired", proposed.NotificationOutcome?.Status);
        s.Office();
        var request = new ReviewProfileCorrectionDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Records.ReadAsync<ProfileCorrection>(s.Scope, "profileCorrection:" + proposed.Id, default))!.Version,
            Decisions = [new FieldDecisionDto { Field = "Contact", Approve = true }]
        };
        var brokenNotices = ActivatorUtilities.CreateInstance<NotificationService>(f.Services, new FailedAccountWrites(s.Records));
        var service = ActivatorUtilities.CreateInstance<MembershipService>(f.Services, brokenNotices);
        var reviewed = await service.ReviewCorrectionAsync(s.Parish, proposed.Id, request, default);
        Assert.Equal(("Reviewed", "Pending"), (reviewed.Status, reviewed.NotificationOutcome?.Status));
        Assert.Equal("updated@fixture.example", (await s.Records.ReadAsync<Person>(s.Scope, "person:" + person, default))!.Value.Contact);
        var row = (await s.Records.ReadAsync<ProfileCorrection>(s.Scope, "profileCorrection:" + proposed.Id, default))!;
        var workId = Assert.Single(row.Value.NotificationWorkIds!);
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(s.Parish, workId, default);
        s.Office();
        Assert.Equal("Stored", (await service.ReviewCorrectionAsync(s.Parish, proposed.Id, request, default)).NotificationOutcome?.Status);
        Assert.Equal(row.Version, (await s.Records.ReadAsync<ProfileCorrection>(s.Scope, "profileCorrection:" + proposed.Id, default))!.Version);
        f.As(applicant, false);
        Assert.Equal("Stored", (await s.Service.CorrectionNotificationOutcomeAsync(s.Parish, proposed.Id, default)).Status);
        Assert.Single((await s.Records.PageAsync<Notification>(Account(applicant), "notification", 100, null, default)).Items);
    }

    [Fact]
    public async Task Invitation_conflict_tracks_office_notice_without_disclosing_its_status_to_the_claimant_or_preview()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        var first = await s.PersonAsync("Existing link");
        var second = await s.PersonAsync("Invited subject");
        s.Office();
        await f.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(s.Parish, new LinkMinistryPersonDto
        { OperationId = Guid.NewGuid(), AccountId = Guid.Parse(applicant), PersonId = Guid.Parse(first), EvidenceReference = "Isolated reviewed identity" }, default);
        var issued = await s.Invitations.CreateAsync(s.Parish, second, new CreatePersonInvitationDto { OperationId = Guid.NewGuid() }, default);
        Assert.Equal("NotRequired", (await s.Invitations.NotificationOutcomeAsync(s.Parish, issued.Id, default)).Status);
        var brokenNotices = ActivatorUtilities.CreateInstance<NotificationService>(f.Services, new FailedAccountWrites(s.Records));
        var service = ActivatorUtilities.CreateInstance<PersonInvitationService>(f.Services, brokenNotices);
        f.As(applicant, false);
        var conflict = await service.AcceptAsync(s.Parish, issued.Id, issued.Token, default);
        Assert.Equal("NeedsReview", conflict.Status);
        Assert.Null(conflict.NotificationOutcome);
        var preview = JsonSerializer.Serialize(await service.PreviewAsync(s.Parish, issued.Id, issued.Token, default));
        Assert.DoesNotContain("Notification", preview);
        await Assert.ThrowsAsync<DomainException>(() => service.NotificationOutcomeAsync(s.Parish, issued.Id, default));
        var row = (await s.Records.ReadAsync<PersonInvitation>(s.Scope, "personInvitation:" + issued.Id, default))!;
        var workId = Assert.Single(row.Value.NotificationWorkIds!);
        s.Office();
        Assert.Equal("Pending", (await service.NotificationOutcomeAsync(s.Parish, issued.Id, default)).Status);
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(s.Parish, workId, default);
        Assert.Equal("Stored", (await service.NotificationOutcomeAsync(s.Parish, issued.Id, default)).Status);
        Assert.Equal(row.Version, (await s.Records.ReadAsync<PersonInvitation>(s.Scope, "personInvitation:" + issued.Id, default))!.Version);
        Assert.Null(Assert.Single(await service.ListAsync(s.Parish, second, default)).Value.NotificationOutcome);
    }

    [Fact]
    public async Task Outcome_HTTP_routes_are_source_authorized_minimal_and_deny_recovery_cookies()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        var stranger = await f.CreateVerifiedMemberAsync();
        f.As(applicant, false);
        var submitted = await s.Service.RequestAsync(s.Parish, Apply(), default);
        var person = await s.PersonAsync("HTTP correction");
        s.Office();
        await f.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(s.Parish, new LinkMinistryPersonDto
        { OperationId = Guid.NewGuid(), AccountId = Guid.Parse(applicant), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity" }, default);
        f.As(applicant, false);
        var correction = await s.Service.ProposeCorrectionAsync(s.Parish, new ProposeProfileCorrectionDto
        { OperationId = Guid.NewGuid(), Fields = [new ProfileCorrectionFieldDto { Field = "Contact", NewValue = "http@fixture.example" }] }, default);
        var invited = await s.PersonAsync("HTTP invitation");
        s.Office();
        var invitation = await s.Invitations.CreateAsync(s.Parish, invited, new CreatePersonInvitationDto { OperationId = Guid.NewGuid() }, default);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var member = factory.Client();
        using var unrelated = factory.Client();
        using var office = factory.Client();
        using var anonymous = factory.Client();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        await MinistryHttpTests.LoginAsync(member, (await users.FindByIdAsync(applicant))!.UserName!);
        await MinistryHttpTests.LoginAsync(unrelated, (await users.FindByIdAsync(stranger))!.UserName!);
        await MinistryHttpTests.LoginAsync(office, "other@fixture.example", true);
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        var root = "/api/parishes/" + s.Parish;
        var ownPaths = new[]
        {
            root + "/membership-requests/" + submitted.Id + "/notification-outcome",
            root + "/profile-corrections/" + correction.Id + "/notification-outcome"
        };
        foreach (var path in ownPaths)
        {
            var response = await member.GetAsync(path);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(["meaning", "status"], json.RootElement.EnumerateObject().Select(p => p.Name).Order().ToArray());
            Assert.Equal("NotRequired", json.RootElement.GetProperty("status").GetString());
            Assert.Equal(HttpStatusCode.NotFound, (await unrelated.GetAsync(path)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await office.GetAsync(path)).StatusCode);
        }
        var invitationPath = root + "/person-invitations/" + invitation.Id + "/notification-outcome";
        member.DefaultRequestHeaders.Add("X-ParishLife-Invitation", invitation.Token);
        Assert.False((await member.GetAsync(invitationPath)).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.OK, (await office.GetAsync(invitationPath)).StatusCode);
        var preview = await member.GetStringAsync(root + "/person-invitations/" + invitation.Id + "/preview");
        Assert.DoesNotContain("notification", preview, StringComparison.OrdinalIgnoreCase);
        office.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        var codes = await MinistryHttpTests.ReadAsync<MfaRecoveryCodesDto>(await office.PostAsJsonAsync("/api/auth/mfa/recovery-codes", new RegenerateRecoveryCodesDto
        { OperationId = Guid.NewGuid(), CurrentPassword = "isolated-fixture-long-password", CurrentCode = TestAuthenticator.Code() }));
        await MinistryHttpTests.CsrfAsync(office);
        var login = await MinistryHttpTests.ReadAsync<JsonElement>(await office.PostAsJsonAsync("/api/auth/login", new { username = "other@fixture.example", password = "isolated-fixture-long-password" }));
        await MinistryHttpTests.ReadAsync<RecoverySignInDto>(await office.PostAsJsonAsync("/api/auth/login/mfa/recovery", new CompleteRecoveryLoginDto
        { AccountId = Guid.Parse(f.Other), Challenge = login.GetProperty("challenge").GetProperty("challenge").GetString()!, RecoveryCode = codes.RecoveryCodes[0] }));
        foreach (var path in ownPaths.Append(invitationPath))
            Assert.Equal(HttpStatusCode.Forbidden, (await office.GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task Historical_missing_tracking_is_not_reported_as_no_notice_required()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, false);
        var request = await s.Service.RequestAsync(s.Parish, Apply(), default);
        var row = (await s.Records.ReadAsync<MembershipRequest>(s.Scope, "membershipRequest:" + request.Id, default))!;
        row.Value.NotificationWorkIds = null;
        await s.Records.CommitAsync(s.Scope, Operation.Create(Guid.NewGuid(), "isolated-operator", new { request.Id }, f.Clock), "test.legacy-tracking", request.Id,
            [RecordChange.Replace("membershipRequest:" + request.Id, "membershipRequest", row.Value, row.Version)], new CommandResult(), default);
        Assert.Equal("NotTracked", (await s.Service.MembershipNotificationOutcomeAsync(s.Parish, request.Id, default)).Status);
        Assert.Null((await s.Records.ReadAsync<MembershipRequest>(s.Scope, "membershipRequest:" + request.Id, default))!.Value.NotificationWorkIds);
    }

    [Fact]
    public async Task Rejected_source_transaction_commits_neither_a_notice_pointer_nor_notification_work()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, false);
        var submitted = await s.Service.RequestAsync(s.Parish, Apply(), default);
        var before = (await s.Records.ReadAsync<MembershipRequest>(s.Scope, "membershipRequest:" + submitted.Id, default))!;
        s.Office();
        var records = new CommitInterceptionRecords(s.Records, () => throw new DomainException("write_conflict", "Isolated rejected source write", FailureKind.Conflict));
        var service = ActivatorUtilities.CreateInstance<MembershipService>(f.Services, records);
        await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(s.Parish, submitted.Id, new MembershipDecisionDto
        { OperationId = Guid.NewGuid(), Version = before.Version, Action = "decline", Reason = "Isolated decision" }, default));
        var after = (await s.Records.ReadAsync<MembershipRequest>(s.Scope, "membershipRequest:" + submitted.Id, default))!;
        Assert.Equal(before.Version, after.Version);
        Assert.Equal("Submitted", after.Value.Status);
        Assert.Empty(after.Value.NotificationWorkIds!);
        Assert.Empty((await s.Records.PageAsync<NotificationWork>(s.Scope, "notificationWork", 100, null, default)).Items);
    }

    private static RecordScope Account(string account) => new() { Area = RecordArea.Account, OwnerId = account };
    private static RequestMembershipDto Apply() => new() { OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Applicant" };

    private sealed record Scenario(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment)
    {
        public string Parish => Staff.Parish;
        public RecordScope Scope => new() { Area = RecordArea.Parish, OwnerId = Parish };
        public IRecordTransactions Records => F.Services.GetRequiredService<IRecordTransactions>();
        public MembershipService Service => F.Services.GetRequiredService<MembershipService>();
        public PersonInvitationService Invitations => F.Services.GetRequiredService<PersonInvitationService>();
        public void Office() => F.AsAppointment(F.Other, Appointment);
        public static async Task<Scenario> CreateAsync(LocalBackendFixture f)
        {
            var staff = await StaffAppointmentScenario.CreateAsync(f);
            await staff.ActivateOfficeAsync(["core", "office"]);
            var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
            return new Scenario(f, staff, appointment.Id);
        }
        public async Task<string> PersonAsync(string name)
        {
            Office();
            return (await F.Services.GetRequiredService<PeopleService>().CreateAsync(Parish, new CreatePersonDto
            { OperationId = Guid.NewGuid(), GivenName = name, FamilyName = "Isolated", BirthDate = new DateOnly(1990, 1, 1) }, default)).Id;
        }
    }

    private sealed class FailedAccountWrites(IRecordTransactions inner) : IRecordTransactions
    {
        public Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct) => inner.ReadAsync<T>(scope, id, ct);
        public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct, params RecordCondition[] conditions)
            => inner.PageAsync<T>(scope, type, size, continuation, ct, conditions);
        public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
            => inner.ScanWorkAsync<T>(area, type, size, continuation, ct);
        public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class => inner.ReplayAsync<T>(scope, operation, ct);
        public Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId, IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null) where T : class
            => scope.Area == RecordArea.Account ? throw new IOException("Isolated notification store interruption") : inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
    }
}
