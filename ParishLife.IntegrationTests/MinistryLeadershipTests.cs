// Purpose: verifies actual ministry leadership authority, atomic handover, private evidence, dated availability and durable history.
// Main tests: current priest gates, co-leader isolation, stale rollback, replay/end/renewal, account lifecycle and parish-authority race fencing.

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryLeadershipTests
{
    [Fact]
    public async Task Appointment_requires_actual_selected_priest_independent_recipient_and_current_mfa()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await MinistryLeadershipScenario.CreateAsync(fixture);
        s.UsePriest();
        var recipient = await fixture.CreateVerifiedStaffAsync();
        var request = await s.RequestAsync(recipient);
        fixture.As(fixture.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => s.Service.AppointAsync(s.Parish, s.Ministry, request, default));
        fixture.As(s.Priest);
        await Assert.ThrowsAsync<DomainException>(() => s.Service.AppointAsync(s.Parish, s.Ministry, request, default));
        fixture.As(s.Priest, mfa: false);
        fixture.Services.GetRequiredService<IHttpContextAccessor>().HttpContext!.Request.Headers["X-ParishLife-Appointment"] = s.Appointment.Id;
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => s.Service.AppointAsync(s.Parish, s.Ministry, request, default))).Code);
        s.UsePriest();
        var selfRequest = await s.RequestAsync(s.Priest);
        Assert.Equal("invalid_leadership_state", (await Assert.ThrowsAsync<DomainException>(() => s.Service.AppointAsync(s.Parish, s.Ministry,
            selfRequest, default))).Code);
        var noMfa = await fixture.CreateVerifiedMemberAsync();
        var noMfaRequest = await s.RequestAsync(noMfa);
        await Assert.ThrowsAsync<DomainException>(() => s.Service.AppointAsync(s.Parish, s.Ministry, noMfaRequest, default));
        var accepted = await s.Service.AppointAsync(s.Parish, s.Ministry, request, default);
        Assert.True(accepted.Effective);
        await s.Staff.ActAsync(s.Appointment, StaffAppointmentAction.Suspend);
        s.UsePriest();
        await Assert.ThrowsAsync<DomainException>(() => s.Service.AppointAsync(s.Parish, s.Ministry, request, default));
    }

    [Fact]
    public async Task Co_leaders_are_independent_and_ordinary_leader_views_never_reveal_appointment_evidence()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await MinistryLeadershipScenario.CreateAsync(fixture);
        s.UsePriest();
        var leader = await fixture.CreateVerifiedStaffAsync();
        var assistant = await fixture.CreateVerifiedStaffAsync();
        await s.AppointAsync(leader);
        await s.AppointAsync(assistant, "Assistant");
        s.UsePriest();
        var priestRows = await s.Service.ListAsync(s.Parish, s.Ministry, 25, null, default);
        Assert.Equal(2, priestRows.Items.Count);
        Assert.All(priestRows.Items, row => { Assert.Null(row.Value.EvidenceReference); Assert.Null(row.Value.EndReason); });
        Assert.NotNull((await s.Service.GetAsync(s.Parish, s.Ministry, leader, default)).Value.EvidenceReference);
        fixture.As(leader);
        Assert.Null((await s.Service.GetAsync(s.Parish, s.Ministry, assistant, default)).Value.EvidenceReference);
        Assert.Equal(2, (await s.Service.ListAsync(s.Parish, s.Ministry, 25, null, default)).Items.Count);
        await Assert.ThrowsAsync<DomainException>(() => s.Service.HistoryAsync(s.Parish, s.Ministry, assistant, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => s.Service.ListAsync(s.Parish, Guid.NewGuid().ToString("N"), 25, null, default));
        var users = fixture.Services.GetRequiredService<UserManager<ParishUser>>();
        var account = (await users.FindByIdAsync(leader))!;
        account.TwoFactorEnabled = false;
        Assert.True((await users.UpdateAsync(account)).Succeeded);
        await Assert.ThrowsAsync<DomainException>(() => s.Service.ListAsync(s.Parish, s.Ministry, 25, null, default));
        s.UsePriest();
        Assert.False((await s.Service.GetAsync(s.Parish, s.Ministry, leader, default)).Value.Effective);
        Assert.True((await s.Service.GetAsync(s.Parish, s.Ministry, assistant, default)).Value.Effective);
    }

    [Fact]
    public async Task Stale_handover_rolls_back_incoming_outgoing_and_history_then_valid_handover_preserves_work()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await MinistryLeadershipScenario.CreateAsync(fixture);
        s.UsePriest();
        var outgoing = await fixture.CreateVerifiedStaffAsync();
        var incoming = await fixture.CreateVerifiedStaffAsync();
        var original = await s.AppointAsync(outgoing);
        s.UsePriest();
        var request = await s.RequestAsync(incoming);
        request.ReplaceAccountId = Guid.Parse(outgoing);
        request.ReplaceVersion = "stale-version";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => s.Service.AppointAsync(s.Parish, s.Ministry, request, default))).Code);
        Assert.Null(await s.Records.ReadAsync<MinistryLeader>(s.Scope, "ministryLeader:" + s.Ministry + ":" + incoming, default));
        Assert.True((await s.Service.GetAsync(s.Parish, s.Ministry, outgoing, default)).Value.Effective);
        Assert.Single((await s.Service.HistoryAsync(s.Parish, s.Ministry, outgoing, 25, null, default)).Items);
        request.ReplaceVersion = (await s.Service.GetAsync(s.Parish, s.Ministry, outgoing, default)).Version;
        var appointed = await s.Service.AppointAsync(s.Parish, s.Ministry, request, default);
        Assert.True(appointed.Effective);
        Assert.Equal(outgoing, appointed.ReplacesAccountId);
        var ended = (await s.Service.GetAsync(s.Parish, s.Ministry, outgoing, default)).Value;
        Assert.True(ended.Revoked);
        Assert.False(ended.Effective);
        Assert.Equal(fixture.Clock.Now, ended.EndedAt);
        var history = await s.Service.HistoryAsync(s.Parish, s.Ministry, outgoing, 25, null, default);
        Assert.Equal(2, history.Items.Count);
        Assert.Contains(history.Items, item => item.Action == "Appointed" && !item.Appointment.Revoked && item.Appointment.Id == original.Id);
        Assert.Contains(history.Items, item => item.Action == "HandedOver" && item.Appointment.Revoked);
        fixture.As(outgoing);
        await Assert.ThrowsAsync<DomainException>(() => s.Service.ListAsync(s.Parish, s.Ministry, 25, null, default));
        s.UsePriest();
        Assert.Equal(appointed.Id, (await s.Service.AppointAsync(s.Parish, s.Ministry, request, default)).Id);
        Assert.Single((await s.Service.HistoryAsync(s.Parish, s.Ministry, incoming, 25, null, default)).Items);
    }

    [Fact]
    public async Task Ending_and_reappointment_keep_history_and_replay_returns_current_state_without_private_receipts()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await MinistryLeadershipScenario.CreateAsync(fixture);
        s.UsePriest();
        var leader = await fixture.CreateVerifiedStaffAsync();
        var initial = await s.RequestAsync(leader);
        var appointed = await s.Service.AppointAsync(s.Parish, s.Ministry, initial, default);
        var end = new EndMinistryLeaderDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Service.GetAsync(s.Parish, s.Ministry, leader, default)).Version,
            Reason = "Private isolated ending detail"
        };
        var ended = await s.Service.EndAsync(s.Parish, s.Ministry, leader, end, default);
        Assert.False(ended.Effective);
        Assert.Equal(end.Reason, ended.EndReason);
        var replay = await s.Service.AppointAsync(s.Parish, s.Ministry, initial, default);
        Assert.True(replay.Revoked);
        Assert.False(replay.Effective);
        Assert.True((await s.Service.EndAsync(s.Parish, s.Ministry, leader, end, default)).Revoked);
        var renewed = await s.AppointAsync(leader);
        s.UsePriest();
        Assert.NotEqual(appointed.Id, renewed.Id);
        Assert.True(renewed.Effective);
        Assert.Equal(renewed.Id, (await s.Service.EndAsync(s.Parish, s.Ministry, leader, end, default)).Id);
        Assert.Equal(3, (await s.Service.HistoryAsync(s.Parish, s.Ministry, leader, 25, null, default)).Items.Count);
        var receipts = await s.Records.PageAsync<JsonElement>(s.Scope, "operation", 100, null, default);
        var audit = await s.Records.PageAsync<JsonElement>(s.Scope, "audit", 100, null, default);
        var safe = JsonSerializer.Serialize(new { receipts.Items, Audit = audit.Items });
        Assert.DoesNotContain(initial.EvidenceReference, safe, StringComparison.Ordinal);
        Assert.DoesNotContain(end.Reason, safe, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Future_expired_deactivated_and_denied_leaders_do_not_report_effective_authority()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await MinistryLeadershipScenario.CreateAsync(fixture);
        s.UsePriest();
        var leader = await fixture.CreateVerifiedStaffAsync();
        var request = await s.RequestAsync(leader, startsAt: fixture.Clock.Now.AddHours(1));
        request.EndsAt = fixture.Clock.Now.AddHours(2);
        Assert.False((await s.Service.AppointAsync(s.Parish, s.Ministry, request, default)).Effective);
        fixture.As(leader);
        await Assert.ThrowsAsync<DomainException>(() => s.Service.ListAsync(s.Parish, s.Ministry, 25, null, default));
        fixture.Clock.Now = fixture.Clock.Now.AddMinutes(90);
        s.UsePriest();
        Assert.True((await s.Service.GetAsync(s.Parish, s.Ministry, leader, default)).Value.Effective);
        var users = fixture.Services.GetRequiredService<UserManager<ParishUser>>();
        var account = (await users.FindByIdAsync(leader))!;
        account.Active = false;
        Assert.True((await users.UpdateAsync(account)).Succeeded);
        Assert.False((await s.Service.GetAsync(s.Parish, s.Ministry, leader, default)).Value.Effective);
        account.Active = true;
        Assert.True((await users.UpdateAsync(account)).Succeeded);
        fixture.As(fixture.FirstAdmin);
        await fixture.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(leader), Allows = [Permissions.PeopleRead], Denies = [Permissions.MinistriesManage], StartsAt = fixture.Clock.Now
        }, default);
        s.UsePriest();
        Assert.False((await s.Service.GetAsync(s.Parish, s.Ministry, leader, default)).Value.Effective);
        fixture.As(leader);
        await Assert.ThrowsAsync<DomainException>(() => s.Service.ListAsync(s.Parish, s.Ministry, 25, null, default));
        fixture.Clock.Now = fixture.Clock.Now.AddHours(1);
        s.UsePriest();
        Assert.False((await s.Service.GetAsync(s.Parish, s.Ministry, leader, default)).Value.Effective);
    }

    [Fact]
    public async Task Priest_revocation_between_check_and_commit_fences_every_leadership_write()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await MinistryLeadershipScenario.CreateAsync(fixture);
        s.UsePriest();
        var recipient = await fixture.CreateVerifiedStaffAsync();
        var request = await s.RequestAsync(recipient);
        var intercept = new InterceptRecords(s.Records, async () =>
        {
            await s.Staff.ActAsync(s.Appointment, StaffAppointmentAction.Suspend);
            s.UsePriest();
        });
        var service = ActivatorUtilities.CreateInstance<MinistryLeadershipService>(fixture.Services, intercept);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.AppointAsync(s.Parish, s.Ministry, request, default))).Code);
        Assert.Null(await s.Records.ReadAsync<MinistryLeader>(s.Scope, "ministryLeader:" + s.Ministry + ":" + recipient, default));
        Assert.Empty((await s.Records.PageAsync<MinistryLeadershipHistory>(s.Scope, "ministryLeadershipChange", 100, null, default)).Items);
    }

    private sealed class InterceptRecords(IRecordTransactions inner, Func<Task> beforeCommit) : IRecordTransactions
    {
        public Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct) => inner.ReadAsync<T>(scope, id, ct);
        public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct,
            params RecordCondition[] conditions) => inner.PageAsync<T>(scope, type, size, continuation, ct, conditions);
        public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
            => inner.ScanWorkAsync<T>(area, type, size, continuation, ct);
        public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class
            => inner.ReplayAsync<T>(scope, operation, ct);
        public async Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId,
            IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null) where T : class
        {
            await beforeCommit();
            return await inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
        }
    }
}
