// Purpose: verifies certificate release/withdrawal notices bind the exact request subject and retain source/outcome authority in isolated storage.
// Main tests: recipient failure preserves an effective release with durable Pending work until actorless repair; replay and withdrawal
// preserve gates/history; wrong request links and concurrent rematching produce no release/notice; HTTP outcome reads remain staff-only.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Requests;
using ParishLife.Api.Services.Sacraments;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CertificateNotificationOutcomeTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Secretary, string Releaser)
    {
        internal string Parish => Staff.Parish;
        internal IRecordTransactions Records => F.Services.GetRequiredService<IRecordTransactions>();
        internal RecordScope Scope => new() { Area = RecordArea.Parish, OwnerId = Parish };
        internal CertificateService Certificates => F.Services.GetRequiredService<CertificateService>();
        internal SacramentService Sacraments => F.Services.GetRequiredService<SacramentService>();
        internal RequestService Requests => F.Services.GetRequiredService<RequestService>();
        internal void Priest() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Release_and_withdrawal_notify_only_the_matched_request_applicant_and_report_pending_until_real_storage()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var source = await RegisteredAsync(x);
        var applicant = await ApplicantAsync(x, source.Person);
        var certificate = await IssuedAsync(x, source, applicant.Request);
        Assert.Equal("NotRequired", certificate.NotificationOutcome!.Status);
        f.As(x.Releaser);
        var release = await ActionAsync(x, certificate.Id, "release");
        var before = await RowAsync<Certificate>(x, "certificate:" + certificate.Id);
        var stale = await ActionAsync(x, certificate.Id, "release");
        stale.Version = "\"stale\"";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Certificates.ActAsync(x.Parish, certificate.Id, stale, default))).Code);
        Assert.Equal(before.Version, (await RowAsync<Certificate>(x, "certificate:" + certificate.Id)).Version);
        Assert.Empty(await WorksAsync(x));

        var brokenNotices = ActivatorUtilities.CreateInstance<NotificationService>(f.Services, new NotificationRecipientFaultRecords(x.Records));
        var producer = ActivatorUtilities.CreateInstance<CertificateService>(f.Services, brokenNotices);
        f.As(x.Releaser);
        var released = await producer.ActAsync(x.Parish, certificate.Id, release, default);
        Assert.Equal(("Released", "Pending"), (released.Status, released.NotificationOutcome!.Status));
        var committed = await RowAsync<Certificate>(x, "certificate:" + certificate.Id);
        var work = Assert.Single(await WorksAsync(x));
        Assert.Equal((applicant.Account, "CertificateApplicant", certificate.Id), (work.AccountId, work.Audience, work.ResourceId));
        Assert.Equal(work.Id, Assert.Single(committed.Value.NotificationWorkIds!));
        Assert.DoesNotContain("Private isolated", JsonSerializer.Serialize(work));
        Assert.DoesNotContain(certificate.Reference, work.Title);
        Assert.Equal($"/api/parishes/{x.Parish}/requests/{applicant.Request}", work.Link);
        f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(x.Parish, work.Id, default);
        f.As(x.Releaser);
        var replay = await producer.ActAsync(x.Parish, certificate.Id, release, default);
        Assert.Equal(("Released", "Stored"), (replay.Status, replay.NotificationOutcome!.Status));
        Assert.Equal(committed.Version, (await RowAsync<Certificate>(x, "certificate:" + certificate.Id)).Version);
        Assert.Single(await WorksAsync(x));

        var withdrawal = await ActionAsync(x, certificate.Id, "withdraw");
        withdrawal.Reason = "Private isolated withdrawal reason";
        var withdrawn = await x.Certificates.ActAsync(x.Parish, certificate.Id, withdrawal, default);
        Assert.Equal(("Withdrawn", "Stored"), (withdrawn.Status, withdrawn.NotificationOutcome!.Status));
        Assert.Equal(released.ReleasedAt, withdrawn.ReleasedAt);
        Assert.Equal(released.RecipientName, withdrawn.RecipientName);
        var last = Assert.Single((await RowAsync<Certificate>(x, "certificate:" + certificate.Id)).Value.NotificationWorkIds!);
        Assert.NotEqual(work.Id, last);
        f.As(x.Secretary);
        Assert.Equal("Stored", (await x.Certificates.GetAsync(x.Parish, certificate.Id, default)).Value.NotificationOutcome!.Status);
        f.As(applicant.Account, false);
        var notices = (await f.Services.GetRequiredService<NotificationService>().ListAsync(null, 25, null, default)).Items;
        Assert.Equal(2, notices.Count);
        Assert.All(notices, notice => Assert.Equal("There is an update to your certificate request.", notice.Title));

        var unlinked = await IssuedAsync(x, await RegisteredAsync(x), requestId: null);
        f.As(x.Releaser);
        var noRecipient = await x.Certificates.ActAsync(x.Parish, unlinked.Id, await ActionAsync(x, unlinked.Id, "release"), default);
        Assert.Equal(("Released", "NotRequired"), (noRecipient.Status, noRecipient.NotificationOutcome!.Status));
        Assert.Equal(2, (await WorksAsync(x)).Length);
    }

    [Fact]
    public async Task Wrong_or_rematched_request_subjects_never_commit_a_certificate_release_or_notice()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var first = await RegisteredAsync(x);
        var other = await RegisteredAsync(x);
        var applicant = await ApplicantAsync(x, first.Person);
        f.As(x.Secretary);
        var wrong = CertificateRequest(other, applicant.Request);
        Assert.Equal("invalid_certificate_state", (await Assert.ThrowsAsync<DomainException>(() => x.Certificates.CreateAsync(x.Parish, wrong, default))).Code);
        wrong.RequestId = Guid.NewGuid();
        Assert.Equal("invalid_certificate_state", (await Assert.ThrowsAsync<DomainException>(() => x.Certificates.CreateAsync(x.Parish, wrong, default))).Code);
        Assert.Empty((await x.Records.PageAsync<Certificate>(x.Scope, "certificate", 100, null, default)).Items);
        Assert.Empty(await WorksAsync(x));

        var certificate = await IssuedAsync(x, first, applicant.Request);
        var intercepted = new CommitInterceptionRecords(x.Records, async () =>
        {
            x.Priest();
            await x.Requests.ActAsync(x.Parish, applicant.Request, new RequestActionDto
            {
                OperationId = Guid.NewGuid(), Version = (await RowAsync<ParishRequest>(x, "request:" + applicant.Request)).Version,
                Action = "match-subject", SubjectPersonId = Guid.Parse(other.Person),
                AuthorityEvidence = "Identity review matched this case to a different person"
            }, default);
        });
        var producer = ActivatorUtilities.CreateInstance<CertificateService>(f.Services, intercepted);
        f.As(x.Releaser);
        var release = await ActionAsync(x, certificate.Id, "release");
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => producer.ActAsync(x.Parish, certificate.Id, release, default))).Code);
        Assert.Equal("Issued", (await RowAsync<Certificate>(x, "certificate:" + certificate.Id)).Value.Status);
        Assert.Empty(await WorksAsync(x));
        f.As(x.Releaser);
        Assert.Equal("invalid_certificate_state", (await Assert.ThrowsAsync<DomainException>(() => x.Certificates.ActAsync(x.Parish, certificate.Id, release, default))).Code);
        var withdrawal = await ActionAsync(x, certificate.Id, "withdraw");
        withdrawal.Reason = "Withdraw a legacy request mismatch without sending to anyone";
        var withdrawn = await x.Certificates.ActAsync(x.Parish, certificate.Id, withdrawal, default);
        Assert.Equal(("Withdrawn", "NotRequired"), (withdrawn.Status, withdrawn.NotificationOutcome!.Status));
        Assert.Empty(await WorksAsync(x));
    }

    [Fact]
    public async Task Certificate_HTTP_outcome_is_available_only_to_existing_readers_and_legacy_rows_are_not_claimed_stored()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var source = await RegisteredAsync(x);
        var applicant = await ApplicantAsync(x, source.Person);
        var certificate = await IssuedAsync(x, source, applicant.Request);
        f.As(x.Releaser);
        await x.Certificates.ActAsync(x.Parish, certificate.Id, await ActionAsync(x, certificate.Id, "release"), default);
        var row = await RowAsync<Certificate>(x, "certificate:" + certificate.Id);
        var workId = Assert.Single(row.Value.NotificationWorkIds!);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var reader = factory.Client();
        using var member = factory.Client();
        using var releaser = factory.Client();
        using var visitor = factory.Client();
        await MinistryHttpTests.LoginAsync(reader, await UsernameAsync(f, x.Secretary), mfa: true);
        await MinistryHttpTests.LoginAsync(member, applicant.Username);
        await MinistryHttpTests.LoginAsync(releaser, await UsernameAsync(f, x.Releaser), mfa: true);
        var path = $"/api/parishes/{x.Parish}/certificates/{certificate.Id}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(path + "/notification-outcome")).StatusCode);
        Assert.False((await member.GetAsync(path + "/notification-outcome")).IsSuccessStatusCode);
        Assert.False((await releaser.GetAsync(path + "/notification-outcome")).IsSuccessStatusCode);
        var outcome = await MinistryHttpTests.ReadAsync<JsonElement>(await reader.GetAsync(path + "/notification-outcome"));
        Assert.Equal("Stored", outcome.GetProperty("status").GetString());
        Assert.Equal(new[] { "meaning", "status" }, outcome.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
        Assert.DoesNotContain(workId, outcome.GetRawText());
        var full = await (await reader.GetAsync(path)).Content.ReadAsStringAsync();
        Assert.DoesNotContain("notificationWorkIds", full);
        Assert.DoesNotContain(workId, full);
        row.Value.NotificationWorkIds = null;
        await x.Records.CommitAsync(x.Scope, Operation.Create(Guid.NewGuid(), "isolated-operator", new { certificate.Id }, f.Clock),
            "test.legacy-certificate", certificate.Id, [RecordChange.Replace("certificate:" + certificate.Id, "certificate", row.Value, row.Version)], row.Value, default);
        Assert.Equal("NotTracked", (await MinistryHttpTests.ReadAsync<NotificationOutcomeDto>(await reader.GetAsync(path + "/notification-outcome"))).Status);
        var list = await MinistryHttpTests.ReadAsync<Versioned<CertificateDto>[]>(await reader.GetAsync($"/api/parishes/{x.Parish}/certificates"));
        Assert.All(list, value => Assert.Null(value.Value.NotificationOutcome));
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "sacraments", "requests"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows:
        [Permissions.SacramentsRecord, Permissions.PeopleRead, Permissions.PeopleWrite, Permissions.RequestsManage]));
        var secretary = await GrantAsync(staff, Permissions.SacramentsRecord);
        var releaser = await GrantAsync(staff, Permissions.DocumentsRelease);
        var x = new Setup(f, staff, appointment.Id, secretary, releaser);
        x.Priest();
        await x.Sacraments.SetPolicyAsync(x.Parish, new NumberingPolicyDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", Format = "BAP-{n}", PerYear = false, ApprovalReference = "Isolated approved numbering"
        }, default);
        return x;
    }

    private static async Task<string> GrantAsync(StaffAppointmentScenario staff, string permission)
    {
        var account = await staff.Fixture.CreateVerifiedStaffAsync();
        staff.Fixture.As(staff.Fixture.FirstAdmin);
        await staff.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(account), Allows = [permission], StartsAt = staff.Fixture.Clock.Now
        }, default);
        return account;
    }

    private static async Task<(string Person, string Record)> RegisteredAsync(Setup x)
    {
        x.Priest();
        var person = (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Private isolated", FamilyName = "Subject", BirthDate = new DateOnly(1990, 1, 1)
        }, default)).Id;
        var source = await x.Sacraments.CreateAsync(x.Parish, new CreateSacramentDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", SubjectPersonId = Guid.Parse(person)
        }, default);
        foreach (var action in new[] { "accept", "record-celebration", "register" })
        {
            var request = new SacramentActionDto
            {
                OperationId = Guid.NewGuid(), Version = (await RowAsync<SacramentRecord>(x, "sacrament:" + source.Id)).Version, Action = action
            };
            if (action == "record-celebration")
            {
                request.CelebratedAt = x.F.Clock.Now.AddHours(-1); request.Place = "Private isolated church"; request.CelebrantName = "Private isolated priest";
            }
            await x.Sacraments.ActAsync(x.Parish, source.Id, request, default);
        }
        return (person, source.Id);
    }

    private static async Task<(string Account, string Request, string Username)> ApplicantAsync(Setup x, string person)
    {
        var account = await x.F.CreateVerifiedMemberAsync();
        x.Priest();
        await x.F.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), PersonId = Guid.Parse(person), EvidenceReference = "Isolated independent identity review"
        }, default);
        x.F.As(account, false);
        var request = await x.Requests.SubmitAsync(x.Parish, new SubmitRequestDto
        {
            OperationId = Guid.NewGuid(), Kind = "Certificate", Summary = "Private isolated certificate request"
        }, default);
        return (account, request.Id, await UsernameAsync(x.F, account));
    }

    private static CreateCertificateDto CertificateRequest((string Person, string Record) source, string? request)
        => new()
        {
            OperationId = Guid.NewGuid(), SubjectPersonId = Guid.Parse(source.Person), SourceRecordId = Guid.Parse(source.Record),
            RequestId = request is null ? null : Guid.Parse(request), Sacrament = "Baptism", Language = "en", Quantity = 1, Purpose = "Private isolated purpose"
        };

    private static async Task<CertificateDto> IssuedAsync(Setup x, (string Person, string Record) source, string? requestId)
    {
        x.F.As(x.Secretary);
        var certificate = await x.Certificates.CreateAsync(x.Parish, CertificateRequest(source, requestId), default);
        foreach (var action in new[] { "prepare", "submit" })
            await x.Certificates.ActAsync(x.Parish, certificate.Id, await ActionAsync(x, certificate.Id, action), default);
        x.Priest();
        await x.Certificates.ActAsync(x.Parish, certificate.Id, await ActionAsync(x, certificate.Id, "sign"), default);
        x.F.As(x.F.Nominee);
        await x.Certificates.ActAsync(x.Parish, certificate.Id, await ActionAsync(x, certificate.Id, "accept"), default);
        x.F.As(x.Releaser);
        return await x.Certificates.ActAsync(x.Parish, certificate.Id, await ActionAsync(x, certificate.Id, "issue"), default);
    }

    private static async Task<CertificateActionDto> ActionAsync(Setup x, string id, string action)
        => new()
        {
            OperationId = Guid.NewGuid(), Version = (await RowAsync<Certificate>(x, "certificate:" + id)).Version, Action = action,
            RecipientName = action == "release" ? "Private isolated collector" : null,
            RecipientRelationship = action == "release" ? "Self" : null,
            VerificationMethod = action == "release" ? "InPerson" : null,
            VerificationEvidence = action == "release" ? "Private isolated verified identity" : null
        };

    private static async Task<Versioned<T>> RowAsync<T>(Setup x, string key) => (await x.Records.ReadAsync<T>(x.Scope, key, default))!;

    private static async Task<NotificationWork[]> WorksAsync(Setup x)
        => (await x.Records.PageAsync<NotificationWork>(x.Scope, "notificationWork", 100, null, default)).Items.Select(row => row.Value).ToArray();

    private static async Task<string> UsernameAsync(LocalBackendFixture f, string account)
        => (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(account))!.UserName!;
}
