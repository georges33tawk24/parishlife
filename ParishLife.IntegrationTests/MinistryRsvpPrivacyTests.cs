// Purpose: verifies confidential RSVP reasons against real ministry workflows, protected storage and authenticated HTTP.
// Main tests: versioned set/clear/retry, projection privacy, exact reader delegation and revocation, author history after departure,
// concurrent membership rollback, CSRF and personal-capacity boundaries without inferring attendance.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryRsvpPrivacyTests
{
    private const string PrivateReason = "Isolated confidential reason belonging only to the original author";

    [Fact]
    public async Task Set_clear_and_retry_preserve_versions_and_protected_history_without_leaking_into_safe_projections()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var privacy = Privacy(f);
        f.As(s.Account, false);
        var request = new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Reason = PrivateReason };
        Assert.Equal(PrivateReason, (await privacy.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, request, default)).Reason);
        var row = await privacy.GetOwnAsync(s.Scope.Parish, s.Group, s.Meeting.Id, default);
        Assert.True(row.Value.CanEdit);
        var second = new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Version = row.Version, Reason = "Updated isolated private reason" };
        await privacy.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, second, default);
        Assert.Equal(second.Reason, (await privacy.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, request, default)).Reason);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => privacy.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id,
            new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Version = row.Version, Reason = "Rejected stale private update" }, default))).Code);
        row = await privacy.GetOwnAsync(s.Scope.Parish, s.Group, s.Meeting.Id, default);
        var clear = new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Version = row.Version, Clear = true };
        var cleared = await privacy.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, clear, default);
        Assert.True(cleared.Cleared);
        Assert.Null(cleared.Reason);
        var replay = await privacy.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, request, default);
        Assert.True(replay.Cleared);
        Assert.Null(replay.Reason);
        var records = Records(f);
        var area = MinistryAccess.Scope(s.Scope.Parish);
        var revisions = await records.PageAsync<MinistryRsvpReasonRevision>(area, "ministryRsvpReasonRevision", 100, null, default);
        Assert.Equal(3, revisions.Items.Count);
        Assert.Equal(2, revisions.Items.Count(item => item.Value.ProtectedReason is not null));
        s.Scope.Use();
        var safe = JsonSerializer.Serialize(new
        {
            Replies = await Meetings(f).RsvpsAsync(s.Scope.Parish, s.Group, s.Meeting.Id, 100, null, default),
            Meeting = await Meetings(f).GetAsync(s.Scope.Parish, s.Group, s.Meeting.Id, default),
            Public = await s.Scope.Ministries.PublicAsync(s.Scope.Parish, 100, null, default),
            Audit = await records.PageAsync<JsonElement>(area, "audit", 100, null, default),
            Receipt = await records.PageAsync<JsonElement>(area, "operation", 100, null, default),
            Revisions = revisions
        });
        Assert.DoesNotContain(PrivateReason, safe, StringComparison.Ordinal);
        Assert.DoesNotContain(second.Reason!, safe, StringComparison.Ordinal);
        Assert.Empty((await records.PageAsync<JsonElement>(area, "attendanceSheet", 100, null, default)).Items);
        f.As(s.Account, false);
        Assert.Equal("No", (await Meetings(f).OwnRsvpAsync(s.Scope.Parish, s.Group, s.Meeting.Id, default)).Value.Response);
    }

    [Fact]
    public async Task Only_the_current_explicit_reader_can_read_another_persons_reason_and_duty_removal_takes_effect_immediately()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f, [Permissions.MinistriesRsvpPrivateRead]);
        var service = Privacy(f);
        f.As(s.Account, false);
        await service.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Reason = PrivateReason }, default);
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Scope.Parish, s.Group, s.Meeting.Id, s.Person, default));
        var reader = await f.CreateVerifiedStaffAsync();
        s.Scope.Use();
        var leadership = f.Services.GetRequiredService<MinistryLeadershipService>();
        await leadership.AppointAsync(s.Scope.Parish, s.Group, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(),
            MinistryVersion = (await s.Scope.Ministries.GetAsync(s.Scope.Parish, s.Group, default)).Version,
            AccountId = Guid.Parse(reader),
            Role = "Leader",
            Duties = ["rsvp.private.read"],
            StartsAt = f.Clock.Now,
            EndsAt = f.Clock.Now.AddDays(5),
            EvidenceReference = "Actual isolated reader appointment"
        }, default);
        f.As(reader);
        var visible = await service.GetAsync(s.Scope.Parish, s.Group, s.Meeting.Id, s.Person, default);
        Assert.Equal(PrivateReason, visible.Value.Reason);
        Assert.False(visible.Value.CanEdit);
        Assert.Empty(visible.Version);
        await Assert.ThrowsAsync<DomainException>(() => service.GetOwnAsync(s.Scope.Parish, s.Group, s.Meeting.Id, default));
        f.As(reader, false);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Scope.Parish, s.Group, s.Meeting.Id, s.Person, default));
        f.AsRecovery(reader);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Scope.Parish, s.Group, s.Meeting.Id, s.Person, default));
        s.Scope.Use();
        var leader = await leadership.GetAsync(s.Scope.Parish, s.Group, reader, default);
        await leadership.ChangeDutiesAsync(s.Scope.Parish, s.Group, reader, new ChangeMinistryLeaderDutiesDto
        { OperationId = Guid.NewGuid(), Version = leader.Version, Duties = [], EvidenceReference = "Actual isolated revocation", Reason = "Reader duty removed" }, default);
        f.As(reader);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(s.Scope.Parish, s.Group, s.Meeting.Id, s.Person, default));
        s.Scope.Use();
        Assert.Equal(PrivateReason, (await service.GetAsync(s.Scope.Parish, s.Group, s.Meeting.Id, s.Person, default)).Value.Reason);
    }

    [Fact]
    public async Task Original_author_retains_read_only_history_after_departure_and_completed_retries_cannot_restore_editing()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var service = Privacy(f);
        f.As(s.Account, false);
        var request = new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Reason = PrivateReason };
        await service.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, request, default);
        var leave = await s.Scope.ApplyAsync(s.Group, s.Account, "Leave");
        await s.Scope.ApplicationActionAsync(s.Group, leave.Id, "approve");
        f.As(s.Account, false);
        var retained = await service.GetOwnAsync(s.Scope.Parish, s.Group, s.Meeting.Id, default);
        Assert.Equal(PrivateReason, retained.Value.Reason);
        Assert.False(retained.Value.CanEdit);
        Assert.False((await service.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, request, default)).CanEdit);
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id,
            new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Version = retained.Version, Clear = true }, default));
        await Assert.ThrowsAsync<DomainException>(() => Meetings(f).GetAsync(s.Scope.Parish, s.Group, s.Meeting.Id, default));
        f.As(f.Nominee);
        await Assert.ThrowsAsync<DomainException>(() => service.GetOwnAsync(s.Scope.Parish, s.Group, s.Meeting.Id, default));
    }

    [Fact]
    public async Task Deadline_missing_reply_and_concurrent_departure_fail_without_creating_private_records_or_receipts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Setup(f);
        var service = Privacy(f);
        var other = await s.Scope.LinkedApplicantAsync();
        var join = await s.Scope.ApplyAsync(s.Group, other.AccountId);
        await s.Scope.ApplicationActionAsync(s.Group, join.Id, "approve");
        f.As(other.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id,
            new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Reason = PrivateReason }, default));
        f.As(s.Account, false);
        var now = f.Clock.Now;
        f.Clock.Now = s.Meeting.RsvpDeadline!.Value;
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id,
            new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Reason = PrivateReason }, default));
        f.Clock.Now = now;
        var leave = await s.Scope.ApplyAsync(s.Group, s.Account, "Leave");
        f.As(s.Account, false);
        var request = new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Reason = PrivateReason };
        var intercept = new CommitInterceptionRecords(Records(f), async () =>
        {
            await s.Scope.ApplicationActionAsync(s.Group, leave.Id, "approve");
            f.As(s.Account, false);
        });
        var concurrent = ActivatorUtilities.CreateInstance<MinistryRsvpPrivacyService>(f.Services, intercept);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => concurrent.SaveAsync(s.Scope.Parish, s.Group, s.Meeting.Id, request, default))).Code);
        var area = MinistryAccess.Scope(s.Scope.Parish);
        Assert.Null(await Records(f).ReadAsync<MinistryRsvpReason>(area, "ministryRsvpReason:" + s.Meeting.Id + ":" + s.Person, default));
        Assert.Empty((await Records(f).PageAsync<JsonElement>(area, "ministryRsvpReasonRevision", 100, null, default)).Items);
        Assert.Null(await Records(f).ReadAsync<JsonElement>(area, "operation:" + request.OperationId.ToString("N"), default));
    }

    [Fact]
    public async Task Http_private_reason_requires_personal_cookie_and_csrf_and_public_contracts_exclude_persistence_models()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.Clock.Now = DateTimeOffset.UtcNow;
        var s = await Setup(f);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        using var anonymous = factory.Client();
        var path = $"/api/parishes/{s.Scope.Parish}/ministries/{s.Group}/meetings/{s.Meeting.Id}/rsvp-private-reason";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
        await Csrf(client);
        await Read<AccountDto>(await client.PostAsJsonAsync("/api/auth/login", new { username = s.Username, password = "isolated-fixture-long-password" }));
        await Csrf(client);
        var request = new SaveRsvpReasonDto { OperationId = Guid.NewGuid(), Reason = PrivateReason };
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(path, request)).StatusCode);
        await Csrf(client);
        Assert.Equal(PrivateReason, (await Read<PrivateRsvpReasonDto>(await client.PutAsJsonAsync(path, request))).Reason);
        Assert.True((await Read<Versioned<PrivateRsvpReasonDto>>(await client.GetAsync(path))).Value.CanEdit);
        client.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Scope.Appointment);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
        client.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        var unauthorizedReader = await client.GetAsync(path + "/" + s.Person);
        Assert.Equal(HttpStatusCode.Forbidden, unauthorizedReader.StatusCode);
        Assert.Equal("mfa_required", (await unauthorizedReader.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString());
        var schemas = (await Read<JsonElement>(await client.GetAsync("/openapi/v1.json"))).GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.TryGetProperty("SaveRsvpReasonDto", out _));
        Assert.True(schemas.TryGetProperty("PrivateRsvpReasonDto", out _));
        Assert.False(schemas.TryGetProperty("MinistryRsvpReason", out _));
        Assert.False(schemas.TryGetProperty("MinistryRsvpReasonRevision", out _));
    }

    private static async Task<ReasonScenario> Setup(LocalBackendFixture f, string[]? extraDuties = null)
    {
        var scope = await MinistryScenario.CreateAsync(f, extraDuties);
        var group = await scope.MinistryAsync(publish: true);
        var member = await scope.LinkedApplicantAsync();
        var application = await scope.ApplyAsync(group.Id, member.AccountId);
        await scope.ApplicationActionAsync(group.Id, application.Id, "approve");
        scope.Use();
        var meeting = await Meetings(f).SaveAsync(scope.Parish, group.Id, null, new SaveMinistryMeetingDto
        {
            OperationId = Guid.NewGuid(),
            Title = "Isolated private RSVP meeting",
            StartsAt = f.Clock.Now.AddDays(1),
            EndsAt = f.Clock.Now.AddDays(1).AddHours(1),
            TimeZone = "UTC",
            RsvpMode = "Optional",
            RsvpDeadline = f.Clock.Now.AddHours(12),
            Agenda = "Isolated non-confidential agenda"
        }, default);
        var version = (await Meetings(f).GetAsync(scope.Parish, group.Id, meeting.Id, default)).Version;
        meeting = await Meetings(f).ActAsync(scope.Parish, group.Id, meeting.Id, new MinistryMeetingActionDto
        { OperationId = Guid.NewGuid(), Version = version, Action = "confirm", Reason = "Actual isolated confirmation" }, default);
        f.As(member.AccountId, false);
        await Meetings(f).RsvpAsync(scope.Parish, group.Id, meeting.Id, new RsvpDto { OperationId = Guid.NewGuid(), Response = "No" }, default);
        return new ReasonScenario(scope, group.Id, meeting, member.AccountId, member.PersonId, member.Username);
    }

    private sealed record ReasonScenario(MinistryScenario Scope, string Group, MinistryMeetingDto Meeting, string Account, string Person, string Username);
    private static IRecordTransactions Records(LocalBackendFixture f) => f.Services.GetRequiredService<IRecordTransactions>();
    private static MinistryMeetingService Meetings(LocalBackendFixture f) => f.Services.GetRequiredService<MinistryMeetingService>();
    private static MinistryRsvpPrivacyService Privacy(LocalBackendFixture f) => f.Services.GetRequiredService<MinistryRsvpPrivacyService>();
    private static async Task Csrf(HttpClient client)
    {
        var result = await Read<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", result.GetProperty("token").GetString());
    }
    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
