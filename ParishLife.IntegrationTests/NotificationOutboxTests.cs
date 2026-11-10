// Purpose: verifies required in-app notices survive source/recipient interruption and acknowledgment races using isolated real storage.
// Main tests: actual request commit recovery, failed recipient storage, failed source acknowledgment, legacy receipt preservation, concurrent actorless relays,
// current recipient eligibility, neutral work payloads and the actual enabled hosted worker; no Azure or external delivery is used.

using System.Text.Json;
using Microsoft.AspNetCore.Http;
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

public class NotificationOutboxTests
{
    [Fact]
    public async Task Request_committed_before_process_interruption_has_a_durable_notice_repaired_without_the_browser_actor()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "requests"]);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, false);
        var requests = f.Services.GetRequiredService<RequestService>();
        var request = await requests.SubmitAsync(staff.Parish, new SubmitRequestDto
        {
            OperationId = Guid.NewGuid(), Kind = "General", Summary = "Private fixture subject",
            Details = new() { ["note"] = "Private fixture details" }
        }, default);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var scope = Scope(staff.Parish);
        var row = (await records.ReadAsync<ParishRequest>(scope, "request:" + request.Id, default))!;
        var action = new RequestActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "accept" };
        f.As(f.FirstAdmin);
        var interrupted = new FaultRecords(records, afterCommit: (_, eventName, _) => eventName == "request.accept"
            ? throw new IOException("Isolated process interruption after source commit") : Task.CompletedTask);
        var producer = ActivatorUtilities.CreateInstance<RequestService>(f.Services, interrupted);
        await Assert.ThrowsAsync<IOException>(() => producer.ActAsync(staff.Parish, request.Id, action, default));
        Assert.Equal("AcceptedForProcessing", (await records.ReadAsync<ParishRequest>(scope, "request:" + request.Id, default))!.Value.Status);
        var work = Assert.Single((await records.PageAsync<NotificationWork>(scope, "notificationWork", 100, null, default)).Items).Value;
        Assert.Equal("Pending", work.Status);
        var json = JsonSerializer.Serialize(work);
        Assert.DoesNotContain("Private fixture", json);
        Assert.DoesNotContain(request.Reference, json);
        Assert.Empty((await records.PageAsync<Notification>(Account(applicant), "notification", 100, null, default)).Items);
        f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(staff.Parish, work.Id, default);
        Assert.Equal("Stored", (await records.ReadAsync<NotificationWork>(scope, "notificationWork:" + work.Id, default))!.Value.Status);
        var notice = Assert.Single((await records.PageAsync<Notification>(Account(applicant), "notification", 100, null, default)).Items).Value;
        Assert.Equal("There is an update to your request.", notice.Title);
        f.As(f.FirstAdmin);
        Assert.Equal("AcceptedForProcessing", (await requests.ActAsync(staff.Parish, request.Id, action, default)).Status);
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(staff.Parish, work.Id, default);
        Assert.Single((await records.PageAsync<Notification>(Account(applicant), "notification", 100, null, default)).Items);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Failed_recipient_commit_is_not_acknowledged_and_a_fresh_relay_repairs_it(bool conflict)
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var broken = new FaultRecords(s.Records, beforeCommit: (scope, _, _) => scope.Area == RecordArea.Account
            ? throw (conflict ? new DomainException("write_conflict", "Isolated recipient conflict", FailureKind.Conflict) : new IOException("Isolated recipient interruption"))
            : Task.CompletedTask);
        var service = ActivatorUtilities.CreateInstance<NotificationService>(f.Services, broken);
        await service.DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default);
        Assert.Equal("Pending", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        Assert.Null(await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + s.Work.Id, default));
        f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(s.Parish, s.Work.Id, default);
        Assert.Equal("Stored", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        Assert.Single((await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items);
    }

    [Fact]
    public async Task Lost_acknowledgment_retries_without_resetting_an_already_read_notification()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var broken = new FaultRecords(s.Records, beforeCommit: (_, _, changes) => changes.Any(c => c.Type == "notificationWork" && c.Action == "replace")
            ? throw new IOException("Isolated acknowledgment interruption") : Task.CompletedTask);
        await ActivatorUtilities.CreateInstance<NotificationService>(f.Services, broken).DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default);
        Assert.Equal("Pending", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        var saved = (await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + s.Work.Id, default))!;
        f.As(f.FirstAdmin);
        var notices = f.Services.GetRequiredService<NotificationService>();
        await notices.SetStateAsync(saved.Value.Id, new NotificationStateDto { Status = "Read" }, default);
        await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(s.Parish, s.Work.Id, default)));
        var final = Assert.Single((await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items).Value;
        Assert.Equal((saved.Value.Id, saved.Value.CreatedAt, "Read"), (final.Id, final.CreatedAt, final.Status));
        Assert.Equal("Stored", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
    }

    [Fact]
    public async Task Existing_legacy_receipt_and_wording_are_accepted_without_rewriting_notice_state()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var notices = f.Services.GetRequiredService<NotificationService>();
        await notices.NotifyAsync(f.FirstAdmin, s.Parish, s.Work.Topic, "Original historical wording", null, true, s.DedupKey, default);
        f.As(f.FirstAdmin);
        await notices.SetStateAsync(s.Work.Id, new NotificationStateDto { Status = "Read" }, default);
        var original = (await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + s.Work.Id, default))!;
        // Construct the old account-receipt contract explicitly, independent of the relay's implementation.
        var topic = s.Work.Topic;
        var dedupKey = s.DedupKey;
        var legacy = Operation.Create(Guid.Parse(s.Work.Id), "system:notifications", new { topic, dedupKey }, f.Clock, "notification");
        Assert.Equal(s.Work.Id, (await s.Records.ReplayAsync<CommandResult>(Account(f.FirstAdmin), legacy, default))!.Id);
        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        await notices.DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default);
        var saved = (await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + s.Work.Id, default))!;
        Assert.Equal(original.Version, saved.Version);
        Assert.Equal(("Original historical wording", "Read", original.Value.CreatedAt), (saved.Value.Title, saved.Value.Status, saved.Value.CreatedAt));
        Assert.Equal("Stored", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
    }

    [Fact]
    public async Task Current_account_eligibility_is_rechecked_without_discarding_pending_required_work()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var owner = (await users.FindByIdAsync(f.FirstAdmin))!;
        owner.Active = false;
        Assert.True((await users.UpdateAsync(owner)).Succeeded);
        var relay = f.Services.GetRequiredService<NotificationProcessor>();
        await relay.ProcessOneAsync(s.Parish, s.Work.Id, default);
        Assert.Null(await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + s.Work.Id, default));
        Assert.Equal("Pending", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        owner = (await users.FindByIdAsync(f.FirstAdmin))!;
        owner.Active = true;
        Assert.True((await users.UpdateAsync(owner)).Succeeded);
        await relay.ProcessOneAsync(s.Parish, s.Work.Id, default);
        Assert.Equal("Stored", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
    }

    [Fact]
    public async Task Reassigned_incident_does_not_send_a_pending_notice_to_the_old_handler()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var incident = new Incident { Id = Guid.NewGuid().ToString("N"), ParishId = staff.Parish, HandlerAccountId = f.Other };
        var change = f.Services.GetRequiredService<NotificationService>().StageRequired(staff.Parish, f.Other, "incident.assigned",
            "An incident record has been assigned to you.", "/api/parishes/" + staff.Parish + "/incidents/" + incident.Id,
            "incident-fixture:" + incident.Id, "IncidentHandler", incident.Id, f.Clock.Now);
        var work = (NotificationWork)change.Value!;
        // The source now has a different handler, even if an earlier assignment notice remains queued.
        incident.HandlerAccountId = f.Nominee;
        await records.CommitAsync(Scope(staff.Parish), Operation.Create(Guid.NewGuid(), "isolated-operator", new { incident.Id }, f.Clock),
            "test.incident-reassignment", incident.Id, [RecordChange.Create("incident:" + incident.Id, "incident", incident), change], new CommandResult(), default);
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(staff.Parish, work.Id, default);
        Assert.Null(await records.ReadAsync<Notification>(Account(f.Other), "notification:" + work.Id, default));
        Assert.Equal("Pending", (await records.ReadAsync<NotificationWork>(Scope(staff.Parish), "notificationWork:" + work.Id, default))!.Value.Status);
    }

    [Fact]
    public async Task Existing_notice_from_another_parish_is_never_counted_as_this_obligations_success()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var other = new Notification
        {
            Id = s.Work.Id, AccountId = f.FirstAdmin, ParishId = Guid.NewGuid().ToString("N"), Topic = s.Work.Topic,
            Kind = "Required", Title = "A different parish notice", CreatedAt = f.Clock.Now, Status = "Read"
        };
        await s.Records.CommitAsync(Account(f.FirstAdmin), Operation.Create(Guid.NewGuid(), "isolated-operator", new { other.Id }, f.Clock),
            "test.other-notice", other.Id, [RecordChange.Create("notification:" + other.Id, "notification", other)], new CommandResult(), default);
        await f.Services.GetRequiredService<NotificationService>().DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default);
        Assert.Equal("Pending", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        var saved = (await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + other.Id, default))!.Value;
        Assert.Equal((other.ParishId, other.Title, "Read"), (saved.ParishId, saved.Title, saved.Status));
    }

    [Fact]
    public async Task Confidential_submitter_keeps_neutral_own_case_notice_without_a_current_person_link_or_operating_parish()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var root = (await records.ReadAsync<Parish>(Scope(staff.Parish), "parish", default))!;
        root.Value.Status = ParishStatus.Closed;
        var concern = new Concern { Id = Guid.NewGuid().ToString("N"), ParishId = staff.Parish, ApplicantAccountId = applicant };
        var change = f.Services.GetRequiredService<NotificationService>().StageRequired(staff.Parish, applicant, "concern.update",
            "There is an update to your confidential case.", "/api/parishes/" + staff.Parish + "/concerns/" + concern.Id,
            "concern-fixture:" + concern.Id, "ConcernApplicant", concern.Id, f.Clock.Now);
        var work = (NotificationWork)change.Value!;
        await records.CommitAsync(Scope(staff.Parish), Operation.Create(Guid.NewGuid(), "isolated-operator", new { concern.Id }, f.Clock),
            "test.historical-concern", concern.Id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Create("concern:" + concern.Id, "concern", concern), change], new CommandResult(), default);
        f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(staff.Parish, work.Id, default);
        Assert.Equal("Stored", (await records.ReadAsync<NotificationWork>(Scope(staff.Parish), "notificationWork:" + work.Id, default))!.Value.Status);
        Assert.Equal("There is an update to your confidential case.", (await records.ReadAsync<Notification>(Account(applicant), "notification:" + work.Id, default))!.Value.Title);
    }

    [Fact]
    public async Task Actual_enabled_hosted_worker_drains_committed_work_in_its_isolated_storage()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f, closed: true);
        await using var factory = new LocalApiFactory(f.DirectoryPath, runJobs: true);
        using var client = factory.Client();
        var deadline = DateTime.UtcNow.AddSeconds(12);
        while ((await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status != "Stored"
            && DateTime.UtcNow < deadline)
            await Task.Delay(100);
        Assert.Equal("Stored", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        Assert.NotNull(await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + s.Work.Id, default));
    }

    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordScope Account(string account) => new() { Area = RecordArea.Account, OwnerId = account };

    private static async Task<(string Parish, IRecordTransactions Records, NotificationWork Work, string DedupKey)> StageOwnerAsync(LocalBackendFixture f, bool closed = false)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var dedupKey = "parish-status-fixture:" + Guid.NewGuid().ToString("N");
        var change = f.Services.GetRequiredService<NotificationService>().StageRequired(staff.Parish, f.FirstAdmin, "parish.status",
            "Your parish's operating status has changed.", null, dedupKey, "ParishOwner", staff.Parish, f.Clock.Now);
        var changes = new List<RecordChange> { change };
        if (closed)
        {
            var root = (await records.ReadAsync<Parish>(Scope(staff.Parish), "parish", default))!;
            root.Value.Status = ParishStatus.Closed;
            changes.Add(RecordChange.Replace("parish", "parish", root.Value, root.Version));
        }
        await records.CommitAsync(Scope(staff.Parish), Operation.Create(Guid.NewGuid(), "isolated-operator", new { dedupKey }, f.Clock),
            "test.stage-required", staff.Parish, changes, new CommandResult(), default);
        return (staff.Parish, records, (NotificationWork)change.Value!, dedupKey);
    }

    private sealed class FaultRecords(IRecordTransactions inner,
        Func<RecordScope, string, IReadOnlyList<RecordChange>, Task>? beforeCommit = null,
        Func<RecordScope, string, IReadOnlyList<RecordChange>, Task>? afterCommit = null) : IRecordTransactions
    {
        public Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct) => inner.ReadAsync<T>(scope, id, ct);
        public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct, params RecordCondition[] conditions)
            => inner.PageAsync<T>(scope, type, size, continuation, ct, conditions);
        public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
            => inner.ScanWorkAsync<T>(area, type, size, continuation, ct);
        public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class => inner.ReplayAsync<T>(scope, operation, ct);
        public async Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId, IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null) where T : class
        {
            if (beforeCommit is not null) await beforeCommit(scope, action, changes);
            var committed = await inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
            if (afterCommit is not null) await afterCommit(scope, action, changes);
            return committed;
        }
    }
}
