// Purpose: verifies member-safe unlisted group details and honest current meeting reply flags after archive or coverage lapse.
// Main tests: exact membership/personal-capacity gates, departure/closure revocation, replay-to-read consistency and real HTTP projection isolation.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryProjectionTests
{
    [Fact]
    public async Task Unlisted_group_overview_requires_exact_current_personal_membership_and_omits_internal_facts()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await MinistryScenario.CreateAsync(fixture);
        var group = await scenario.MinistryAsync();
        var otherGroup = await scenario.MinistryAsync();
        var member = await JoinAsync(scenario, group.Id);
        var unrelated = await scenario.LinkedApplicantAsync();
        fixture.As(member.AccountId, false);
        var overview = await scenario.Ministries.MemberInfoAsync(scenario.Parish, group.Id, default);
        Assert.Equal(group.Id, overview.Id);
        Assert.Equal(group.Purpose, overview.Purpose);
        Assert.Equal("Active", overview.Status);
        var json = JsonSerializer.Serialize(overview).ToLowerInvariant();
        Assert.DoesNotContain("eligibilitypolicyreference", json);
        Assert.DoesNotContain("accountid", json);
        Assert.DoesNotContain("personid", json);
        Assert.DoesNotContain("approvedby", json);
        Assert.DoesNotContain("createdby", json);
        Assert.DoesNotContain(group.EligibilityPolicyReference!.ToLowerInvariant(), json);
        Assert.Empty((await scenario.Ministries.PublicAsync(scenario.Parish, 25, null, default)).Items);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Ministries.GetAsync(scenario.Parish, group.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => scenario.Ministries.MemberInfoAsync(scenario.Parish, otherGroup.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => scenario.Ministries.MemberInfoAsync(Guid.NewGuid().ToString("N"), group.Id, default));
        fixture.As(unrelated.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Ministries.MemberInfoAsync(scenario.Parish, group.Id, default));
        fixture.AsAppointment(member.AccountId, scenario.Appointment);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Ministries.MemberInfoAsync(scenario.Parish, group.Id, default));
    }

    [Fact]
    public async Task Approved_departure_and_group_archive_end_member_overview_access_without_erasing_own_case_history()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await MinistryScenario.CreateAsync(fixture);
        var group = await scenario.MinistryAsync();
        var member = await JoinAsync(scenario, group.Id);
        var departure = await scenario.ApplyAsync(group.Id, member.AccountId, "Leave");
        fixture.As(member.AccountId, false);
        Assert.Equal(group.Id, (await scenario.Ministries.MemberInfoAsync(scenario.Parish, group.Id, default)).Id);
        await scenario.ApplicationActionAsync(group.Id, departure.Id, "approve");
        fixture.As(member.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Ministries.MemberInfoAsync(scenario.Parish, group.Id, default));
        Assert.Equal("Approved", (await scenario.Applications.GetAsync(scenario.Parish, group.Id, departure.Id, default)).Value.Status);
        var currentMember = await JoinAsync(scenario, group.Id);
        await scenario.ActAsync(group.Id, "archive");
        fixture.As(currentMember.AccountId, false);
        await Assert.ThrowsAsync<DomainException>(() => scenario.Ministries.MemberInfoAsync(scenario.Parish, group.Id, default));
        scenario.Use();
        Assert.Equal("Archived", (await scenario.Ministries.GetAsync(scenario.Parish, group.Id, default)).Value.Status);
    }

    [Fact]
    public async Task Completed_create_and_confirmation_replay_match_current_closed_group_reply_availability()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await MinistryScenario.CreateAsync(fixture);
        var group = await scenario.MinistryAsync();
        var service = fixture.Services.GetRequiredService<MinistryMeetingService>();
        scenario.Use();
        var request = Draft(fixture);
        var meeting = await service.SaveAsync(scenario.Parish, group.Id, null, request, default);
        var confirm = new MinistryMeetingActionDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await service.GetAsync(scenario.Parish, group.Id, meeting.Id, default)).Version,
            Action = "confirm"
        };
        Assert.True((await service.ActAsync(scenario.Parish, group.Id, meeting.Id, confirm, default)).RsvpOpen);
        await scenario.ActAsync(group.Id, "archive");
        scenario.Use();
        var actual = (await service.GetAsync(scenario.Parish, group.Id, meeting.Id, default)).Value;
        Assert.False(actual.RsvpOpen);
        var createReplay = await service.SaveAsync(scenario.Parish, group.Id, null, request, default);
        var confirmationReplay = await service.ActAsync(scenario.Parish, group.Id, meeting.Id, confirm, default);
        Assert.Equal(actual.Status, createReplay.Status);
        Assert.Equal(actual.RsvpOpen, createReplay.RsvpOpen);
        Assert.Equal(actual.RsvpOpen, confirmationReplay.RsvpOpen);
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(scenario.Parish, group.Id, null, Draft(fixture), default));
    }

    [Fact]
    public async Task Completed_replay_survives_module_lapse_with_current_closed_reply_flags_but_new_work_is_blocked()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var scenario = await MinistryScenario.CreateAsync(fixture);
        var group = await scenario.MinistryAsync();
        var service = fixture.Services.GetRequiredService<MinistryMeetingService>();
        scenario.Use();
        var request = Draft(fixture);
        var meeting = await service.SaveAsync(scenario.Parish, group.Id, null, request, default);
        var confirm = new MinistryMeetingActionDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await service.GetAsync(scenario.Parish, group.Id, meeting.Id, default)).Version,
            Action = "confirm"
        };
        await service.ActAsync(scenario.Parish, group.Id, meeting.Id, confirm, default);
        await EndCoverageAsync(scenario);
        scenario.Use();
        var actual = (await service.GetAsync(scenario.Parish, group.Id, meeting.Id, default)).Value;
        Assert.False(actual.RsvpOpen);
        Assert.Equal(actual.RsvpOpen, (await service.SaveAsync(scenario.Parish, group.Id, null, request, default)).RsvpOpen);
        Assert.Equal(actual.RsvpOpen, (await service.ActAsync(scenario.Parish, group.Id, meeting.Id, confirm, default)).RsvpOpen);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(scenario.Parish, group.Id, null, Draft(fixture), default))).Code);
    }

    [Fact]
    public async Task HTTP_member_overview_uses_current_cookie_identity_and_a_distinct_safe_schema()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var scenario = await MinistryScenario.CreateAsync(fixture);
        var group = await scenario.MinistryAsync();
        var member = await JoinAsync(scenario, group.Id);
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var client = factory.Client();
        var path = $"/api/parishes/{scenario.Parish}/ministries/{group.Id}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path + "/member-info")).StatusCode);
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login",
            new { username = member.Username, password = "isolated-fixture-long-password" })).StatusCode);
        var response = await client.GetAsync(path + "/member-info");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var overview = (await response.Content.ReadFromJsonAsync<MemberMinistryDto>())!;
        Assert.Equal(group.Id, overview.Id);
        Assert.DoesNotContain("eligibilityPolicyReference", json);
        Assert.DoesNotContain("personId", json);
        Assert.DoesNotContain("accountId", json);
        Assert.False((await client.GetAsync(path)).IsSuccessStatusCode);
        client.DefaultRequestHeaders.Add("X-ParishLife-Appointment", scenario.Appointment);
        Assert.False((await client.GetAsync(path + "/member-info")).IsSuccessStatusCode);
        client.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        var schema = (await client.GetFromJsonAsync<JsonElement>("/openapi/v1.json")).GetProperty("components").GetProperty("schemas");
        Assert.True(schema.TryGetProperty("MemberMinistryDto", out _));
    }

    private static SaveMinistryMeetingDto Draft(LocalBackendFixture fixture) => new()
    {
        OperationId = Guid.NewGuid(),
        Title = "Isolated projection meeting",
        StartsAt = fixture.Clock.Now.AddDays(1),
        EndsAt = fixture.Clock.Now.AddDays(1).AddHours(1),
        TimeZone = "UTC"
    };

    private static async Task<(string AccountId, string PersonId, string Username)> JoinAsync(MinistryScenario scenario, string ministry)
    {
        var member = await scenario.LinkedApplicantAsync();
        var application = await scenario.ApplyAsync(ministry, member.AccountId);
        await scenario.ApplicationActionAsync(ministry, application.Id, "approve");
        return member;
    }

    private static async Task EndCoverageAsync(MinistryScenario scenario)
    {
        var records = scenario.Fixture.Services.GetRequiredService<IRecordTransactions>();
        var scope = MinistryAccess.Scope(scenario.Parish);
        var coverage = await records.PageAsync<Coverage>(scope, "coverage", 100, null, default);
        Assert.NotEmpty(coverage.Items);
        foreach (var row in coverage.Items)
        {
            row.Value.EndsAt = scenario.Fixture.Clock.Now;
            await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), scenario.Fixture.FirstAdmin,
                new { end = row.Value.Id }, scenario.Fixture.Clock), "fixture.coverage_end", row.Value.Id,
                [RecordChange.Replace("coverage:" + row.Value.Id, "coverage", row.Value, row.Version)],
                new CommandResult { Id = row.Value.Id, Status = "Ended" }, default);
        }
    }
}
