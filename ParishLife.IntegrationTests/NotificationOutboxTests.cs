// Purpose: verifies required in-app notices survive source/recipient interruption and acknowledgment races using isolated real storage.
// Main tests: actual request commit recovery, failed recipient storage, failed source acknowledgment, legacy receipt preservation, concurrent actorless relays,
// parish-scoped keys, legacy schema/collision recovery, current recipient eligibility, neutral payloads and the actual enabled hosted worker.
// No Azure or external delivery is used.

using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
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
        var legacyId = LegacyId(f.FirstAdmin, s.DedupKey);
        f.As(f.FirstAdmin);
        await notices.SetStateAsync(legacyId, new NotificationStateDto { Status = "Read" }, default);
        var original = (await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + legacyId, default))!;
        // Construct the old account-receipt contract explicitly, independent of the relay's implementation.
        var topic = s.Work.Topic;
        var dedupKey = s.DedupKey;
        var legacy = Operation.Create(Guid.Parse(legacyId), "system:notifications", new { topic, dedupKey }, f.Clock, "notification");
        Assert.Equal(legacyId, (await s.Records.ReplayAsync<CommandResult>(Account(f.FirstAdmin), legacy, default))!.Id);
        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        await notices.DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default);
        var saved = (await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + legacyId, default))!;
        Assert.Equal(original.Version, saved.Version);
        Assert.Equal(("Original historical wording", "Read", original.Value.CreatedAt), (saved.Value.Title, saved.Value.Status, saved.Value.CreatedAt));
        var completed = (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value;
        Assert.Equal("Stored", completed.Status);
        Assert.Equal(legacyId, completed.RecipientNotificationId);
        Assert.Single((await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items);
    }

    [Fact]
    public async Task Two_parishes_can_store_the_same_accounts_same_operation_key_independently()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var second = await SecondParishAsync(f, s.Parish);
        var notices = f.Services.GetRequiredService<NotificationService>();
        var change = notices.StageRequired(second, f.FirstAdmin, s.Work.Topic, "Your parish's operating status has changed.",
            null, s.DedupKey, "ParishOwner", second, f.Clock.Now);
        var other = (NotificationWork)change.Value!;
        await s.Records.CommitAsync(Scope(second), Operation.Create(Guid.NewGuid(), "isolated-operator", new { second }, f.Clock),
            "test.second-obligation", second, [change], new CommandResult(), default);
        Assert.NotEqual(s.Work.Id, other.Id);
        f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await Task.WhenAll(notices.DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default), notices.DispatchAsync(second, f.FirstAdmin, s.DedupKey, default));
        var stored = (await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items;
        Assert.Equal(2, stored.Count);
        Assert.Contains(stored, row => row.Value.ParishId == s.Parish);
        Assert.Contains(stored, row => row.Value.ParishId == second);
        foreach (var pair in new[] { (s.Parish, s.Work.Id), (second, other.Id) })
            Assert.Equal("Stored", (await s.Records.ReadAsync<NotificationWork>(Scope(pair.Item1), "notificationWork:" + pair.Item2, default))!.Value.Status);
        await Task.WhenAll(notices.DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default), notices.DispatchAsync(second, f.FirstAdmin, s.DedupKey, default));
        Assert.Equal(2, (await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items.Count);
    }

    [Fact]
    public async Task Foreign_legacy_notice_does_not_block_new_scoped_work_or_get_overwritten()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var second = await SecondParishAsync(f, s.Parish);
        var notices = f.Services.GetRequiredService<NotificationService>();
        await notices.NotifyAsync(f.FirstAdmin, second, s.Work.Topic, "Historical other-parish wording", null, true, s.DedupKey, default);
        var legacyId = LegacyId(f.FirstAdmin, s.DedupKey);
        f.As(f.FirstAdmin);
        await notices.SetStateAsync(legacyId, new NotificationStateDto { Status = "Read" }, default);
        var legacy = (await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + legacyId, default))!;
        await notices.DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default);
        var final = (await s.Records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + legacyId, default))!;
        Assert.Equal(legacy.Version, final.Version);
        Assert.Equal((second, "Read", "Historical other-parish wording"), (final.Value.ParishId, final.Value.Status, final.Value.Title));
        var work = (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value;
        Assert.Equal("Stored", work.Status);
        Assert.NotEqual(legacyId, work.RecipientNotificationId);
        Assert.Equal(2, (await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items.Count);
    }

    [Fact]
    public async Task Old_work_without_an_identity_version_is_recovered_using_the_legacy_receipt_contract()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var dedupKey = "legacy-work:" + Guid.NewGuid().ToString("N");
        var id = LegacyId(f.FirstAdmin, dedupKey);
        // This is the exact old serialized shape, with no IdentityVersion or RecipientNotificationId member.
        var oldWork = new
        {
            id, parishId = staff.Parish, accountId = f.FirstAdmin, topic = "parish.status", title = "Historical owner notice",
            link = (string?)null, dedupKey, audience = "ParishOwner", resourceId = staff.Parish, createdAt = f.Clock.Now, status = "Pending"
        };
        await records.CommitAsync(Scope(staff.Parish), Operation.Create(Guid.NewGuid(), "isolated-operator", new { id }, f.Clock),
            "test.old-work", id, [RecordChange.Create("notificationWork:" + id, "notificationWork", oldWork)], new CommandResult(), default);
        f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(staff.Parish, id, default);
        var row = (await records.ReadAsync<NotificationWork>(Scope(staff.Parish), "notificationWork:" + id, default))!.Value;
        Assert.Equal(1, row.IdentityVersion);
        Assert.Equal("Stored", row.Status);
        Assert.Equal(id, row.RecipientNotificationId);
        var topic = "parish.status";
        var legacy = Operation.Create(Guid.Parse(id), "system:notifications", new { topic, dedupKey }, f.Clock, "notification");
        Assert.Equal(id, (await records.ReplayAsync<CommandResult>(Account(f.FirstAdmin), legacy, default))!.Id);
    }

    [Fact]
    public async Task Recipient_row_without_its_matching_legacy_receipt_is_not_falsely_acknowledged_or_rewritten()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var id = LegacyId(f.FirstAdmin, s.DedupKey);
        var notice = new Notification { Id = id, AccountId = f.FirstAdmin, ParishId = s.Parish, Topic = s.Work.Topic, Title = s.Work.Title, CreatedAt = f.Clock.Now };
        await s.Records.CommitAsync(Account(f.FirstAdmin), Operation.Create(Guid.NewGuid(), "isolated-operator", new { id }, f.Clock),
            "test.unconfirmed-notice", id, [RecordChange.Create("notification:" + id, "notification", notice)], new CommandResult(), default);
        await f.Services.GetRequiredService<NotificationService>().DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default);
        Assert.Equal("Pending", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        Assert.Single((await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items);
    }

    [Fact]
    public async Task Known_legacy_pending_obligation_with_a_foreign_collision_can_recover_without_rewriting_its_identity()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var second = await SecondParishAsync(f, staff.Parish);
        var dedupKey = "legacy-collision:" + Guid.NewGuid().ToString("N");
        var id = LegacyId(f.FirstAdmin, dedupKey);
        var notices = f.Services.GetRequiredService<NotificationService>();
        await notices.NotifyAsync(f.FirstAdmin, second, "parish.status", "Older foreign-parish notice", null, true, dedupKey, default);
        var before = (await records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + id, default))!;
        var work = new
        {
            id, parishId = staff.Parish, accountId = f.FirstAdmin, topic = "parish.status", title = "Existing pending owner obligation",
            link = (string?)null, dedupKey, audience = "ParishOwner", resourceId = staff.Parish, createdAt = f.Clock.Now, status = "Pending"
        };
        await records.CommitAsync(Scope(staff.Parish), Operation.Create(Guid.NewGuid(), "isolated-operator", new { id }, f.Clock), "test.old-obligation", id,
            [RecordChange.Create("notificationWork:" + id, "notificationWork", work)], new CommandResult(), default);
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(staff.Parish, id, default);
        var completed = (await records.ReadAsync<NotificationWork>(Scope(staff.Parish), "notificationWork:" + id, default))!.Value;
        Assert.Equal((id, 1, "Stored"), (completed.Id, completed.IdentityVersion, completed.Status));
        Assert.NotEqual(id, completed.RecipientNotificationId);
        Assert.Equal(before.Version, (await records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + id, default))!.Version);
        Assert.Equal(staff.Parish, (await records.ReadAsync<Notification>(Account(f.FirstAdmin), "notification:" + completed.RecipientNotificationId, default))!.Value.ParishId);
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(staff.Parish, id, default);
        Assert.Equal(2, (await records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items.Count);
    }

    [Fact]
    public async Task Same_parish_legacy_key_with_a_different_target_is_refused_without_minting_another_notice()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var notices = f.Services.GetRequiredService<NotificationService>();
        await notices.NotifyAsync(f.FirstAdmin, s.Parish, s.Work.Topic, "Historical other target", "/a-different-target", true, s.DedupKey, default);
        await notices.DispatchAsync(s.Parish, f.FirstAdmin, s.DedupKey, default);
        Assert.Equal("Pending", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        Assert.Single((await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items);
    }

    [Fact]
    public async Task Unsupported_saved_identity_version_remains_pending_without_recipient_storage()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StageOwnerAsync(f);
        var row = (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!;
        row.Value.IdentityVersion = 77;
        await s.Records.CommitAsync(Scope(s.Parish), Operation.Create(Guid.NewGuid(), "isolated-operator", new { row.Value.Id }, f.Clock),
            "test.future-work-version", row.Value.Id, [RecordChange.Replace("notificationWork:" + row.Value.Id, "notificationWork", row.Value, row.Version)], new CommandResult(), default);
        await f.Services.GetRequiredService<NotificationProcessor>().ProcessOneAsync(s.Parish, s.Work.Id, default);
        Assert.Equal("Pending", (await s.Records.ReadAsync<NotificationWork>(Scope(s.Parish), "notificationWork:" + s.Work.Id, default))!.Value.Status);
        Assert.Empty((await s.Records.PageAsync<Notification>(Account(f.FirstAdmin), "notification", 100, null, default)).Items);
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

    private static string LegacyId(string account, string dedupKey)
        => new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(account + "\n" + dedupKey)).AsSpan(0, 16)).ToString("N");

    private static async Task<string> SecondParishAsync(LocalBackendFixture f, string first)
    {
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var source = (await records.ReadAsync<Parish>(Scope(first), "parish", default))!.Value;
        var second = Guid.NewGuid().ToString("N");
        // A synthetic second root isolates notification partition routing; it does not grant a real organization any authority.
        var root = new Parish { Id = second, Name = "Isolated second parish", Status = ParishStatus.Verified, OwnerAccountId = source.OwnerAccountId, CreatedAt = f.Clock.Now };
        await records.CommitAsync(Scope(second), Operation.Create(Guid.NewGuid(), "isolated-operator", new { second }, f.Clock), "test.second-root", second,
            [RecordChange.Create("parish", "parish", root)], new CommandResult(), default);
        return second;
    }

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
