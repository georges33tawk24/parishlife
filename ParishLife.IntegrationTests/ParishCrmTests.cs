// Purpose: verifies private manual parish CRM/follow-up (X07) through the real local services, Identity accounts and storage.
// Main tests: only current MFA platform operators may read or write; one record per exact parish with optimistic versions; immutable history
// keeps previous/current snapshots; reasons and notes are protected at rest; exact retries replay; future note occurrences, ineligible
// assignees, unknown stages and dateless-action follow-ups are refused; the cross-parish worklist is operator-only and filterable; due follow-up reads honor the clock; parishes never see each other's records.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Administration;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class ParishCrmTests
{
    private sealed class Setup(LocalBackendFixture f, string parish)
    {
        public LocalBackendFixture F { get; } = f;
        public string Parish { get; } = parish;
        public ParishCrmService Crm => F.Services.GetRequiredService<ParishCrmService>();
    }

    private static async Task<string> RegisterParishAsync(LocalBackendFixture f, string name)
    {
        f.As(f.FirstAdmin);
        var service = f.Services.GetRequiredService<ParishService>();
        var parish = await service.RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(), Name = name, Locality = "Fixture locality", Contact = "fixture.example"
        }, default);
        return parish.Id;
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        await f.InitializeAsync();
        return new Setup(f, await RegisterParishAsync(f, "CRM isolated parish"));
    }

    private static ParishCrmSaveDto Save(string? version, string status = "Onboarding", string reason = "Initial private follow-up reason", Guid? assigned = null,
        string? action = null, DateTimeOffset? at = null)
        => new() { OperationId = Guid.NewGuid(), Version = version, TrackingStatus = status, Reason = reason, AssignedOperatorAccountId = assigned, NextAction = action, FollowUpAt = at };

    [Fact]
    public async Task Operators_create_and_update_one_record_with_immutable_history_and_protected_text()
    {
        await using var f = new LocalBackendFixture();
        var x = await CreateAsync(f);
        f.As(f.FirstAdmin);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Crm.GetAsync(x.Parish, default))).Kind);

        var created = await x.Crm.SaveAsync(x.Parish, Save(null, reason: "SECRET-REASON-ONE", action: "Call the parish priest"), default);
        Assert.Equal(("Created", null), (created.Kind, created.Previous));
        Assert.Equal("SECRET-REASON-ONE", created.Reason);
        Assert.Equal(f.FirstAdmin, created.By);

        var current = await x.Crm.GetAsync(x.Parish, default);
        Assert.Equal(("Onboarding", "Call the parish priest"), (current.Value.TrackingStatus, current.Value.NextAction));

        f.Clock.Now = f.Clock.Now.AddMinutes(5);
        var updated = await x.Crm.SaveAsync(x.Parish, Save(current.Version, status: "Active", reason: "SECRET-REASON-TWO"), default);
        Assert.Equal("Updated", updated.Kind);
        Assert.Equal("Onboarding", updated.Previous!.TrackingStatus);
        Assert.Equal("Active", updated.Current.TrackingStatus);
        Assert.Equal(created.Current.CreatedAt, updated.Current.CreatedAt);

        var history = await x.Crm.HistoryAsync(x.Parish, 25, null, default);
        Assert.Equal(["Created", "Updated"], history.Items.Select(i => i.Kind).Order().ToArray());

        // Reasons are stored only in protected form and are never present as plaintext in the stored entry.
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var raw = (await records.ReadAsync<ParishCrmEntry>(new RecordScope { Area = RecordArea.Platform, OwnerId = "crm:" + x.Parish }, "parishCrmEntry:" + created.Id, default))!.Value;
        Assert.NotNull(raw.ProtectedReason);
        Assert.DoesNotContain("SECRET-REASON-ONE", System.Text.Json.JsonSerializer.Serialize(raw));
    }

    [Fact]
    public async Task Stale_or_missing_versions_conflict_and_exact_retries_replay_without_a_second_entry()
    {
        await using var f = new LocalBackendFixture();
        var x = await CreateAsync(f);
        f.As(f.FirstAdmin);
        var first = Save(null);
        var created = await x.Crm.SaveAsync(x.Parish, first, default);
        var replay = await x.Crm.SaveAsync(x.Parish, first, default);
        Assert.Equal(created.Id, replay.Id);
        Assert.Single((await x.Crm.HistoryAsync(x.Parish, 25, null, default)).Items);

        // Overwriting an existing record without a version is refused as version_required, and a stale version conflicts; nothing is written.
        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.SaveAsync(x.Parish, Save(null, status: "Paused"), default))).Code);
        var version = (await x.Crm.GetAsync(x.Parish, default)).Version;
        await x.Crm.SaveAsync(x.Parish, Save(version, status: "Attention"), default);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.SaveAsync(x.Parish, Save(version, status: "Paused"), default))).Code);
        Assert.Equal("Attention", (await x.Crm.GetAsync(x.Parish, default)).Value.TrackingStatus);
        Assert.Equal(2, (await x.Crm.HistoryAsync(x.Parish, 25, null, default)).Items.Count);

        // A version supplied before any record exists is a conflict, never an implicit create.
        var empty = await RegisterParishAsync(f, "Second CRM parish");
        f.As(f.FirstAdmin);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.SaveAsync(empty, Save(version), default))).Code);
    }

    [Fact]
    public async Task Only_current_mfa_platform_operators_for_an_existing_parish_can_use_the_crm()
    {
        await using var f = new LocalBackendFixture();
        var x = await CreateAsync(f);
        f.As(f.FirstAdmin);
        await x.Crm.SaveAsync(x.Parish, Save(null), default);

        // A verified MFA account that is not a platform operator, a member, an operator without MFA and a recovery session are all refused.
        var member = await f.CreateVerifiedMemberAsync();
        foreach (var denied in new Action[]
        {
            () => f.As(f.Nominee),
            () => f.As(member, mfa: false),
            () => f.As(f.FirstAdmin, mfa: false),
            () => f.AsRecovery(f.FirstAdmin)
        })
        {
            denied();
            await Assert.ThrowsAnyAsync<DomainException>(() => x.Crm.GetAsync(x.Parish, default));
            await Assert.ThrowsAnyAsync<DomainException>(() => x.Crm.SaveAsync(x.Parish, Save(null, status: "Paused"), default));
            await Assert.ThrowsAnyAsync<DomainException>(() => x.Crm.HistoryAsync(x.Parish, 25, null, default));
            await Assert.ThrowsAnyAsync<DomainException>(() => x.Crm.DueAsync(x.Parish, default));
        }

        // The real operator still works after the refused attempts, and none of them wrote anything.
        f.As(f.FirstAdmin);
        Assert.Single((await x.Crm.HistoryAsync(x.Parish, 25, null, default)).Items);

        // Unknown, empty and malformed parish identifiers look the same as an absent resource.
        foreach (var bad in new[] { Guid.NewGuid().ToString("N"), Guid.Empty.ToString("N"), "not-a-parish", Guid.NewGuid().ToString("D") })
            Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Crm.GetAsync(bad, default))).Kind);
    }

    [Fact]
    public async Task Assignees_must_be_eligible_operators_and_dated_follow_ups_need_an_explicit_action()
    {
        await using var f = new LocalBackendFixture();
        var x = await CreateAsync(f);
        f.As(f.FirstAdmin);
        var due = f.Clock.Now.AddDays(3);

        var notOperator = await Assert.ThrowsAsync<DomainException>(() => x.Crm.SaveAsync(x.Parish, Save(null, assigned: Guid.Parse(f.Nominee)), default));
        Assert.Equal("crm_operator_required", notOperator.Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.SaveAsync(x.Parish, Save(null, at: due), default))).Code);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Crm.GetAsync(x.Parish, default))).Kind);

        var saved = await x.Crm.SaveAsync(x.Parish, Save(null, assigned: Guid.Parse(f.SecondAdmin), action: "Send the onboarding pack by hand", at: due), default);
        Assert.Equal(f.SecondAdmin, saved.Current.AssignedOperatorAccountId);
        Assert.Equal("Send the onboarding pack by hand", saved.Current.NextAction);
    }

    [Fact]
    public async Task Notes_need_the_current_version_cannot_claim_the_future_and_replay_exactly()
    {
        await using var f = new LocalBackendFixture();
        var x = await CreateAsync(f);
        f.As(f.FirstAdmin);
        await x.Crm.SaveAsync(x.Parish, Save(null, action: "Phone the secretary"), default);
        var version = (await x.Crm.GetAsync(x.Parish, default)).Version;
        f.Clock.Now = f.Clock.Now.AddHours(2);

        Func<string, DateTimeOffset, ParishCrmNoteDto> note = (v, at) => new() { OperationId = Guid.NewGuid(), Version = v, OccurredAt = at, Text = "SECRET-NOTE-TEXT sanitized summary" };
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.AddNoteAsync(x.Parish, note(version, f.Clock.Now.AddDays(1)), default))).Code);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.AddNoteAsync(x.Parish, note("stale-version", f.Clock.Now.AddHours(-1)), default))).Code);
        Assert.Single((await x.Crm.HistoryAsync(x.Parish, 25, null, default)).Items);

        var request = note(version, f.Clock.Now.AddHours(-1));
        var entry = await x.Crm.AddNoteAsync(x.Parish, request, default);
        Assert.Equal(("Note", "SECRET-NOTE-TEXT sanitized summary"), (entry.Kind, entry.Text));
        Assert.Equal(f.Clock.Now.AddHours(-1), entry.OccurredAt);
        Assert.Equal(entry.Id, (await x.Crm.AddNoteAsync(x.Parish, request, default)).Id);
        Assert.Equal(2, (await x.Crm.HistoryAsync(x.Parish, 25, null, default)).Items.Count);

        // The note advanced the record version, so the earlier version can no longer be used, and the tracked facts did not change.
        Assert.NotEqual(version, (await x.Crm.GetAsync(x.Parish, default)).Version);
        Assert.Equal("Onboarding", (await x.Crm.GetAsync(x.Parish, default)).Value.TrackingStatus);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.AddNoteAsync(x.Parish, note(version, f.Clock.Now.AddHours(-1)), default))).Code);

        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var raw = (await records.ReadAsync<ParishCrmEntry>(new RecordScope { Area = RecordArea.Platform, OwnerId = "crm:" + x.Parish }, "parishCrmEntry:" + entry.Id, default))!.Value;
        Assert.DoesNotContain("SECRET-NOTE-TEXT", System.Text.Json.JsonSerializer.Serialize(raw));
        Assert.Equal(entry.Id, (await x.Crm.EntryAsync(x.Parish, entry.Id, default)).Id);
    }

    [Fact]
    public async Task Due_follow_up_appears_only_after_its_time_and_parishes_never_share_records_or_entries()
    {
        await using var f = new LocalBackendFixture();
        var x = await CreateAsync(f);
        f.As(f.FirstAdmin);
        var due = f.Clock.Now.AddDays(2);
        Assert.Null(await x.Crm.DueAsync(x.Parish, default));
        var saved = await x.Crm.SaveAsync(x.Parish, Save(null, action: "Visit in person", at: due), default);
        Assert.Null(await x.Crm.DueAsync(x.Parish, default));
        f.Clock.Now = due.AddMinutes(1);
        Assert.Equal("Visit in person", (await x.Crm.DueAsync(x.Parish, default))!.Value.NextAction);

        var other = await RegisterParishAsync(f, "Another CRM parish");
        f.As(f.FirstAdmin);
        Assert.Null(await x.Crm.DueAsync(other, default));
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Crm.GetAsync(other, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Crm.EntryAsync(other, saved.Id, default))).Kind);
        Assert.Empty((await x.Crm.HistoryAsync(other, 25, null, default)).Items);
    }

    [Fact]
    public async Task Tracking_status_is_one_of_the_four_adoption_stages()
    {
        await using var f = new LocalBackendFixture();
        var x = await CreateAsync(f);
        f.As(f.FirstAdmin);
        foreach (var bad in new[] { "Contacted", "onboarding", "", "   ", "Great parish", "Onboarding;Active" })
            Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.SaveAsync(x.Parish, Save(null, status: bad), default))).Code);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Crm.GetAsync(x.Parish, default))).Kind);
        foreach (var stage in new[] { "Onboarding", "Active", "Attention", "Paused" })
        {
            var version = await x.Crm.GetAsync(x.Parish, default).ContinueWith(t => t.IsFaulted ? null : t.Result.Version);
            await x.Crm.SaveAsync(x.Parish, Save(version, status: stage), default);
            Assert.Equal(stage, (await x.Crm.GetAsync(x.Parish, default)).Value.TrackingStatus);
        }
    }

    [Fact]
    public async Task Worklist_is_operator_only_filterable_and_orders_due_follow_ups_first()
    {
        await using var f = new LocalBackendFixture();
        var x = await CreateAsync(f);
        var second = await RegisterParishAsync(f, "Second worklist parish");
        var third = await RegisterParishAsync(f, "Third worklist parish");
        await RegisterParishAsync(f, "Never tracked parish");
        f.As(f.FirstAdmin);
        var now = f.Clock.Now;
        await x.Crm.SaveAsync(x.Parish, Save(null, status: "Active"), default);
        await x.Crm.SaveAsync(second, Save(null, status: "Attention", action: "Phone the priest", at: now.AddDays(1)), default);
        await x.Crm.SaveAsync(third, Save(null, status: "Attention", action: "Visit the office", at: now.AddDays(2)), default);

        var all = await x.Crm.WorklistAsync(null, false, 50, null, default);
        Assert.Equal([second, third, x.Parish], all.Items.Select(i => i.Value.ParishId).ToArray());
        Assert.Equal([second, third], (await x.Crm.WorklistAsync("Attention", false, 50, null, default)).Items.Select(i => i.Value.ParishId).ToArray());
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Crm.WorklistAsync("Thriving", false, 50, null, default))).Code);
        Assert.Empty((await x.Crm.WorklistAsync(null, true, 50, null, default)).Items);

        f.Clock.Now = now.AddDays(1).AddMinutes(1);
        Assert.Equal([second], (await x.Crm.WorklistAsync(null, true, 50, null, default)).Items.Select(i => i.Value.ParishId).ToArray());
        f.Clock.Now = now.AddDays(3);
        Assert.Equal([second, third], (await x.Crm.WorklistAsync(null, true, 50, null, default)).Items.Select(i => i.Value.ParishId).ToArray());

        // A parish that was never tracked is simply absent from the worklist.
        Assert.Equal(3, all.Items.Count);

        var member = await f.CreateVerifiedMemberAsync();
        foreach (var denied in new Action[] { () => f.As(f.Nominee), () => f.As(member, mfa: false), () => f.As(f.FirstAdmin, mfa: false), () => f.AsRecovery(f.FirstAdmin) })
        {
            denied();
            await Assert.ThrowsAnyAsync<DomainException>(() => x.Crm.WorklistAsync(null, false, 50, null, default));
        }
    }
}
