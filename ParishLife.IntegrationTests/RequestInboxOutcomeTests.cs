// Purpose: verifies source-authorized request/association/inbox outcomes survive notice failures without leaking a general recipient feed.
// Main tests: committed Pending to Stored repair/replay, guest-association identity boundaries, real HTTP inbox outcomes,
// unrelated/recovery denial, legacy versus no-notice state and source-conflict atomic rollback in isolated local storage.

using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RequestInboxOutcomeTests
{
    [Fact]
    public async Task Saved_request_exposes_pending_then_repaired_status_without_resubmitting_the_case()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup.CreateAsync(f);
        f.As(s.Applicant, false);
        var created = await s.Requests.SubmitAsync(s.Parish, Submit(), default);
        f.As(f.FirstAdmin);
        var body = new RequestActionDto { OperationId = Guid.NewGuid(), Version = await s.VersionAsync(created.Id), Action = "accept" };
        var broken = ActivatorUtilities.CreateInstance<RequestService>(f.Services, FailedNotices(f, s.Records));
        var result = await broken.ActAsync(s.Parish, created.Id, body, default);
        Assert.Equal("AcceptedForProcessing", result.Status);
        Assert.Equal("Pending", result.NotificationOutcome!.Status);
        var sourceVersion = await s.VersionAsync(created.Id);
        f.As(s.Applicant, false);
        Assert.Equal("Pending", (await s.Requests.NotificationOutcomeAsync(s.Parish, created.Id, default)).Status);
        var work = Assert.Single((await s.Records.PageAsync<NotificationWork>(s.Scope, "notificationWork", 100, null, default)).Items).Value;
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(s.Parish, work.Id, default);
        Assert.Equal("Stored", (await s.Requests.GetAsync(s.Parish, created.Id, default)).Value.NotificationOutcome!.Status);
        Assert.Equal(sourceVersion, await s.VersionAsync(created.Id));
        f.As(f.FirstAdmin);
        Assert.Equal("Stored", (await s.Requests.ActAsync(s.Parish, created.Id, body, default)).NotificationOutcome!.Status);
        var json = JsonSerializer.Serialize(await s.Requests.NotificationOutcomeAsync(s.Parish, created.Id, default));
        Assert.DoesNotContain(s.Applicant, json);
        Assert.DoesNotContain(work.Id, json);
        Assert.DoesNotContain("Count", json);
        f.As(f.Other);
        await Assert.ThrowsAsync<DomainException>(() => s.Requests.NotificationOutcomeAsync(s.Parish, created.Id, default));
        f.AsRecovery(s.Applicant);
        await Assert.ThrowsAsync<DomainException>(() => s.Requests.NotificationOutcomeAsync(s.Parish, created.Id, default));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Guest_association_outcome_does_not_give_a_declined_claimant_case_access(bool approve)
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup.CreateAsync(f);
        var receipt = await s.Requests.GuestSubmitAsync(s.Parish, new GuestRequestDto
        {
            OperationId = Guid.NewGuid(), Kind = "General", Summary = "Isolated guest case", RequesterName = "Isolated guest",
            RequesterContact = "fixture@example.test", SubjectDescription = "Isolated subject"
        }, default);
        f.As(s.Applicant, false);
        await s.Requests.ClaimGuestAsync(s.Parish, receipt.RequestId, receipt.TrackingToken, default);
        f.As(f.FirstAdmin);
        var body = new RequestAssociationDto
        {
            OperationId = Guid.NewGuid(), Version = await s.VersionAsync(receipt.RequestId), Approve = approve,
            EvidenceReference = approve ? "Isolated reviewed identity" : null, Reason = approve ? null : "Identity not established"
        };
        var result = await s.Requests.DecideAssociationAsync(s.Parish, receipt.RequestId, body, default);
        Assert.Equal("Stored", result.NotificationOutcome!.Status);
        f.As(s.Applicant, false);
        if (approve) Assert.Equal("Stored", (await s.Requests.NotificationOutcomeAsync(s.Parish, receipt.RequestId, default)).Status);
        else await Assert.ThrowsAsync<DomainException>(() => s.Requests.NotificationOutcomeAsync(s.Parish, receipt.RequestId, default));
    }

    [Fact]
    public async Task Inbox_HTTP_outcomes_keep_committed_messages_and_are_limited_to_their_conversation()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var s = await Setup.CreateAsync(f);
        f.As(s.Applicant, false);
        var inbox = f.Services.GetRequiredService<InboxService>();
        var thread = await inbox.StartAsync(s.Parish, new StartConversationDto { OperationId = Guid.NewGuid(), Subject = "Isolated office query", Body = "Isolated question" }, default);
        Assert.Equal("NotRequired", thread.NotificationOutcome!.Status);
        f.As(f.FirstAdmin);
        var broken = ActivatorUtilities.CreateInstance<InboxService>(f.Services, FailedNotices(f, s.Records));
        var message = await broken.PostAsync(s.Parish, thread.Id, new PostInboxMessageDto { OperationId = Guid.NewGuid(), Body = "Saved office reply" }, default);
        Assert.Equal("Pending", message.NotificationOutcome!.Status);
        var name = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(s.Applicant))!.UserName!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await MinistryHttpTests.LoginAsync(client, name);
        var path = $"/api/parishes/{s.Parish}/inbox/{thread.Id}";
        Assert.Equal("Pending", (await MinistryHttpTests.ReadAsync<NotificationOutcomeDto>(await client.GetAsync(path + "/notification-outcome"))).Status);
        var outcomePath = path + "/messages/" + message.Id + "/notification-outcome";
        var json = await (await client.GetAsync(outcomePath)).Content.ReadAsStringAsync();
        using (var parsed = JsonDocument.Parse(json))
            Assert.Equal(["meaning", "status"], parsed.RootElement.EnumerateObject().Select(x => x.Name).OrderBy(x => x));
        Assert.DoesNotContain("Saved office reply", json);
        Assert.DoesNotContain(s.Applicant, json);
        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(outcomePath)).StatusCode);
        using var stranger = factory.Client();
        await MinistryHttpTests.LoginAsync(stranger, "other@fixture.example", true);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(outcomePath)).StatusCode);
        f.AsRecovery(s.Applicant);
        await Assert.ThrowsAsync<DomainException>(() => inbox.MessageNotificationOutcomeAsync(s.Parish, thread.Id, message.Id, default));
        var work = Assert.Single((await s.Records.PageAsync<NotificationWork>(s.Scope, "notificationWork", 100, null, default)).Items).Value;
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(s.Parish, work.Id, default);
        Assert.Equal("Stored", (await MinistryHttpTests.ReadAsync<NotificationOutcomeDto>(await client.GetAsync(outcomePath))).Status);
    }

    [Fact]
    public async Task Legacy_source_has_untracked_status_and_rejected_source_write_cannot_publish_notice_pointers()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup.CreateAsync(f);
        f.As(s.Applicant, false);
        var created = await s.Requests.SubmitAsync(s.Parish, Submit(), default);
        Assert.Equal("NotRequired", (await s.Requests.NotificationOutcomeAsync(s.Parish, created.Id, default)).Status);
        var row = (await s.Records.ReadAsync<ParishRequest>(s.Scope, "request:" + created.Id, default))!;
        row.Value.NotificationWorkIds = null;
        await s.Records.CommitAsync(s.Scope, Operation.Create(Guid.NewGuid(), "isolated-operator", new { created.Id }, f.Clock), "test.legacy", created.Id,
            [RecordChange.Replace("request:" + created.Id, "parishRequest", row.Value, row.Version)], new CommandResult(), default);
        Assert.Equal("NotTracked", (await s.Requests.NotificationOutcomeAsync(s.Parish, created.Id, default)).Status);
        f.As(f.FirstAdmin);
        var action = new RequestActionDto { OperationId = Guid.NewGuid(), Version = await s.VersionAsync(created.Id), Action = "accept" };
        var concurrent = new CommitInterceptionRecords(s.Records, async () =>
        {
            var latest = (await s.Records.ReadAsync<ParishRequest>(s.Scope, "request:" + created.Id, default))!;
            latest.Value.NextAction = "Concurrent triage";
            await s.Records.CommitAsync(s.Scope, Operation.Create(Guid.NewGuid(), "isolated-operator", new { triage = true }, f.Clock), "test.triage", created.Id,
                [RecordChange.Replace("request:" + created.Id, "parishRequest", latest.Value, latest.Version)], new CommandResult(), default);
        });
        var service = ActivatorUtilities.CreateInstance<RequestService>(f.Services, concurrent);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.ActAsync(s.Parish, created.Id, action, default))).Code);
        Assert.Null((await s.Records.ReadAsync<ParishRequest>(s.Scope, "request:" + created.Id, default))!.Value.NotificationWorkIds);
        Assert.Empty((await s.Records.PageAsync<NotificationWork>(s.Scope, "notificationWork", 100, null, default)).Items);
    }

    private static SubmitRequestDto Submit() => new() { OperationId = Guid.NewGuid(), Kind = "General", Summary = "Isolated request" };

    private static NotificationService FailedNotices(LocalBackendFixture f, IRecordTransactions records)
        => ActivatorUtilities.CreateInstance<NotificationService>(f.Services, new RecipientFailureRecords(records));

    private sealed record Setup(LocalBackendFixture F, string Parish, string Applicant)
    {
        public RecordScope Scope => new() { Area = RecordArea.Parish, OwnerId = Parish };
        public IRecordTransactions Records => F.Services.GetRequiredService<IRecordTransactions>();
        public RequestService Requests => F.Services.GetRequiredService<RequestService>();
        public async Task<string> VersionAsync(string id) => (await Records.ReadAsync<ParishRequest>(Scope, "request:" + id, default))!.Version;
        public static async Task<Setup> CreateAsync(LocalBackendFixture f)
        {
            var staff = await StaffAppointmentScenario.CreateAsync(f);
            await staff.ActivateOfficeAsync(["core", "office", "requests"]);
            return new Setup(f, staff.Parish, await f.CreateVerifiedMemberAsync());
        }
    }

    private sealed class RecipientFailureRecords(IRecordTransactions inner) : IRecordTransactions
    {
        public Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct) => inner.ReadAsync<T>(scope, id, ct);
        public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? cursor, CancellationToken ct, params RecordCondition[] conditions)
            => inner.PageAsync<T>(scope, type, size, cursor, ct, conditions);
        public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? cursor, CancellationToken ct) => inner.ScanWorkAsync<T>(area, type, size, cursor, ct);
        public Task<T?> ReplayAsync<T>(RecordScope scope, Operation op, CancellationToken ct) where T : class => inner.ReplayAsync<T>(scope, op, ct);
        public Task<T> CommitAsync<T>(RecordScope scope, Operation op, string action, string id, IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null) where T : class
            => scope.Area == RecordArea.Account && action == "notification.store" ? throw new IOException("Isolated recipient failure")
                : inner.CommitAsync(scope, op, action, id, changes, result, ct, reason);
    }
}
