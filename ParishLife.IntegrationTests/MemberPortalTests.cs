// Purpose: verifies the member portal's own additions against real local services, protected storage and authenticated HTTP.
// Main tests: private note pin/reminder/meeting link (validation, readable-meeting rule, survival after departure, nothing on disk in clear);
// "My resources" (only active stock of current ministries, no storage, departure, unlinked, appointment and anonymous refusals);
// the notification topic catalog (HTTP, and kept in step with every StageRequired topic in the API source).

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.PersonalWorkspace;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MemberPortalTests
{
    private const string Password = "isolated-fixture-long-password";

    [Fact]
    public async Task Private_notes_keep_pin_reminder_and_a_readable_meeting_link_encrypted_and_validated()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await SetupAsync(f);
        var notes = f.Services.GetRequiredService<PersonalWorkspaceService>();
        var reminder = new DateTimeOffset(2030, 5, 4, 0, 0, 0, TimeSpan.Zero);

        f.As(x.Member.AccountId, false);
        var saved = await notes.SaveAsync(null, Note(x, reminder), default);
        Assert.True(saved.Value.Pinned);
        Assert.Equal(reminder, saved.Value.ReminderAt);
        Assert.Equal(x.Meeting.Id, saved.Value.MeetingId);
        Assert.Equal(x.Ministry, saved.Value.MeetingMinistryId);
        Assert.Equal(x.Parish, saved.Value.MeetingParishId);
        var listed = Assert.Single((await notes.ListAsync(25, null, "Note", null, default)).Items).Value;
        Assert.Equal(x.Meeting.Id, listed.MeetingId);
        var disk = string.Join("\n", Directory.EnumerateFiles(f.DirectoryPath, "*.json", SearchOption.AllDirectories)
            .Where(path => File.ReadAllText(path).Contains("personalWorkspace", StringComparison.Ordinal)).Select(File.ReadAllText));
        Assert.DoesNotContain("Isolated linked note", disk, StringComparison.Ordinal);
        Assert.DoesNotContain("2030-05-04", disk, StringComparison.Ordinal);
        Assert.DoesNotContain("\"pinned\"", disk, StringComparison.OrdinalIgnoreCase);

        // Partial links and non-UTC reminders are refused.
        var partial = Note(x, reminder);
        partial.MeetingMinistryId = null;
        Assert.Equal("invalid_personal_item", (await Assert.ThrowsAsync<DomainException>(() => notes.SaveAsync(null, partial, default))).Code);
        var local = Note(x, new DateTimeOffset(2030, 5, 4, 0, 0, 0, TimeSpan.FromHours(3)));
        Assert.Equal("invalid_personal_item", (await Assert.ThrowsAsync<DomainException>(() => notes.SaveAsync(null, local, default))).Code);

        // A stranger cannot link a meeting they cannot read, even privately.
        var stranger = await x.S.LinkedApplicantAsync();
        f.As(stranger.AccountId, false);
        Assert.Equal("invalid_personal_item", (await Assert.ThrowsAsync<DomainException>(() => notes.SaveAsync(null, Note(x, null), default))).Code);
        Assert.Empty((await notes.ListAsync(25, null, null, null, default)).Items);

        // After leaving the ministry the unchanged link survives an edit; an unpinned edit clears the pin.
        f.Clock.Now = f.Clock.Now.AddHours(1);
        var leave = await x.S.ApplyAsync(x.Ministry, x.Member.AccountId, "Leave");
        await x.S.ApplicationActionAsync(x.Ministry, leave.Id, "approve");
        f.As(x.Member.AccountId, false);
        var edit = Note(x, null);
        edit.Version = saved.Version;
        edit.Pinned = false;
        var edited = await notes.SaveAsync(saved.Value.Id, edit, default);
        Assert.False(edited.Value.Pinned);
        Assert.Null(edited.Value.ReminderAt);
        Assert.Equal(x.Meeting.Id, edited.Value.MeetingId);
        var relink = Note(x, null);
        relink.Version = edited.Version;
        relink.MeetingId = Guid.NewGuid();
        Assert.Equal("invalid_personal_item", (await Assert.ThrowsAsync<DomainException>(() => notes.SaveAsync(saved.Value.Id, relink, default))).Code);
    }

    [Fact]
    public async Task My_resources_lists_only_active_stock_of_current_ministries_without_storage()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await SetupAsync(f);
        var stock = f.Services.GetRequiredService<MinistryResourceService>();
        var service = f.Services.GetRequiredService<MemberMinistryResourceService>();
        f.As(x.Custodian);
        var hymnals = await stock.SaveStockAsync(x.Parish, x.Ministry, null, Stock("Hymnals", 4), default);
        var retired = await stock.SaveStockAsync(x.Parish, x.Ministry, null, Stock("Old banners", 2), default);
        var version = (await f.Services.GetRequiredService<ParishLife.Api.Interfaces.Repositories.Common.IRecordTransactions>()
            .ReadAsync<MinistryStock>(MinistryAccess.Scope(x.Parish), "ministryStock:" + retired.Id, default))!.Version;
        await stock.SaveStockAsync(x.Parish, x.Ministry, retired.Id, new SaveStockDto
        { OperationId = Guid.NewGuid(), Version = version, Name = "Old banners", Total = 2, Status = "Retired" }, default);
        // Another ministry the member does not belong to.
        var other = await x.S.MinistryAsync();
        await AppointAsync(x.S, other.Id, x.Custodian, "resources.custody");
        f.As(x.Custodian);
        await stock.SaveStockAsync(x.Parish, other.Id, null, Stock("Other group projector", 1), default);

        f.As(x.Member.AccountId, false);
        var mine = await service.ListAsync(x.Parish, default);
        var item = Assert.Single(mine.Items);
        Assert.False(mine.Truncated);
        Assert.Equal(hymnals.Id, item.Id);
        Assert.Equal("Hymnals", item.Name);
        Assert.Equal(x.Ministry, item.MinistryId);
        Assert.Equal(4, item.Available);
        Assert.DoesNotContain("Isolated sacristy", JsonSerializer.Serialize(mine), StringComparison.Ordinal);

        // An account linked to a person but in no ministry sees nothing; an unlinked account is refused.
        var stranger = await x.S.LinkedApplicantAsync();
        f.As(stranger.AccountId, false);
        Assert.Empty((await service.ListAsync(x.Parish, default)).Items);
        f.As(await f.CreateVerifiedMemberAsync(), false);
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(x.Parish, default))).Code);

        // A departed member no longer sees the ministry's resources.
        f.Clock.Now = f.Clock.Now.AddHours(1);
        var leave = await x.S.ApplyAsync(x.Ministry, x.Member.AccountId, "Leave");
        await x.S.ApplicationActionAsync(x.Ministry, leave.Id, "approve");
        f.As(x.Member.AccountId, false);
        Assert.Empty((await service.ListAsync(x.Parish, default)).Items);
    }

    [Fact]
    public async Task Http_resources_and_topics_require_sign_in_and_resources_refuse_an_appointment_capacity()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.Clock.Now = DateTimeOffset.UtcNow;
        var x = await SetupAsync(f);
        f.As(x.Custodian);
        await f.Services.GetRequiredService<MinistryResourceService>().SaveStockAsync(x.Parish, x.Ministry, null, Stock("Hymnals", 3), default);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        using var anonymous = factory.Client();
        var resources = $"/api/parishes/{x.Parish}/me/ministry-resources";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(resources)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me/notification-topics")).StatusCode);
        await Csrf(client);
        await Read<AccountDto>(await client.PostAsJsonAsync("/api/auth/login", new { username = x.Member.Username, password = Password }));
        var listed = await Read<MemberMinistryResourcesDto>(await client.GetAsync(resources));
        Assert.Equal("Hymnals", Assert.Single(listed.Items).Name);
        var topics = await Read<NotificationTopicDto[]>(await client.GetAsync("/api/me/notification-topics"));
        Assert.Contains(topics, t => t.Topic == "parish.broadcast" && t.Mutable && !t.Required);
        Assert.Contains(topics, t => t.Topic == "request.update" && t.Required && !t.Mutable);
        client.DefaultRequestHeaders.Add("X-ParishLife-Appointment", x.S.Appointment);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(resources)).StatusCode);
    }

    [Fact]
    public void Topic_catalog_matches_every_required_and_preference_checked_topic_in_the_api_source()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "ParishLife.slnx")))
            root = root.Parent;
        Assert.NotNull(root);
        var source = string.Join("\n", Directory.EnumerateFiles(Path.Combine(root!.FullName, "ParishLife.Api", "Services"), "*.cs", SearchOption.AllDirectories)
            .Select(File.ReadAllText));
        var staged = Regex.Matches(source, @"StageRequired\((?!string )[^;]*?,[^;]*?,\s*""([^""]+)""")
            .Select(m => m.Groups[1].Value).ToHashSet(StringComparer.Ordinal);
        Assert.NotEmpty(staged);
        Assert.Equal(staged.Order(StringComparer.Ordinal), NotificationTopicCatalog.RequiredTopics.Order(StringComparer.Ordinal));
        Assert.Empty(NotificationTopicCatalog.OptionalTopics.Intersect(NotificationTopicCatalog.RequiredTopics));
        // Every service file that checks a mute against its own topic constant (Topic, or a qualified X.Topic such as
        // BroadcastService.Topic in BroadcastAudience) declares that topic in the optional list.
        var muting = Directory.EnumerateFiles(Path.Combine(root.FullName, "ParishLife.Api", "Services"), "*.cs", SearchOption.AllDirectories)
            .Where(path => Regex.IsMatch(File.ReadAllText(path), @"MutedTopics\.Contains\((\w+\.)?Topic\b")).Count();
        Assert.Equal(NotificationTopicCatalog.OptionalTopics.Length, muting);
    }

    private sealed record Scenario(MinistryScenario S, string Ministry, MinistryMeetingDto Meeting, string Custodian,
        (string AccountId, string PersonId, string Username) Member)
    {
        public string Parish => S.Parish;
    }

    private static async Task<Scenario> SetupAsync(LocalBackendFixture f)
    {
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesResourcesManage]);
        var group = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(group.Id, member.AccountId);
        await s.ApplicationActionAsync(group.Id, join.Id, "approve");
        var custodian = await f.CreateVerifiedStaffAsync();
        await AppointAsync(s, group.Id, custodian, "resources.custody");
        s.Use();
        var meetings = f.Services.GetRequiredService<MinistryMeetingService>();
        var meeting = await meetings.SaveAsync(s.Parish, group.Id, null, new SaveMinistryMeetingDto
        {
            OperationId = Guid.NewGuid(), Title = "Isolated member meeting", StartsAt = f.Clock.Now.AddDays(1),
            EndsAt = f.Clock.Now.AddDays(1).AddHours(1), TimeZone = "UTC", RsvpMode = "Optional", RsvpDeadline = f.Clock.Now.AddHours(12),
            Agenda = "Isolated agenda"
        }, default);
        var version = (await meetings.GetAsync(s.Parish, group.Id, meeting.Id, default)).Version;
        meeting = await meetings.ActAsync(s.Parish, group.Id, meeting.Id, new MinistryMeetingActionDto
        { OperationId = Guid.NewGuid(), Version = version, Action = "confirm", Reason = "Isolated confirmation" }, default);
        return new Scenario(s, group.Id, meeting, custodian, member);
    }

    private static async Task AppointAsync(MinistryScenario s, string ministry, string account, string duty)
    {
        s.Use();
        await s.Fixture.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, ministry, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, ministry, default)).Version,
            AccountId = Guid.Parse(account), Role = "Leader", Duties = [duty], StartsAt = s.Fixture.Clock.Now,
            EvidenceReference = "Isolated custody appointment"
        }, default);
    }

    private static SavePersonalItemDto Note(Scenario x, DateTimeOffset? reminder) => new()
    {
        OperationId = Guid.NewGuid(), Kind = "Note", Title = "Isolated linked note", Body = "Isolated linked note body", Pinned = true,
        ReminderAt = reminder, MeetingParishId = Guid.Parse(x.Parish), MeetingMinistryId = Guid.Parse(x.Ministry), MeetingId = Guid.Parse(x.Meeting.Id)
    };

    private static SaveStockDto Stock(string name, int total) => new()
    { OperationId = Guid.NewGuid(), Name = name, Storage = "Isolated sacristy cupboard", Total = total, Status = "Active" };

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
