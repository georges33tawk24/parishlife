// Purpose: exercises the new communications routes through the real host (cookie sign-in, MFA, CSRF, model validation) on isolated storage:
// broadcast automations, the schedule action and the direct-message person route.
// Main test: Automation_schedule_and_person_routes_validate_input_and_refuse_non_staff; helper SignInAsync signs a fixture account in by id.

using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CommunicationsHttpTests
{
    [Fact]
    public async Task Automation_schedule_and_person_routes_validate_input_and_refuse_non_staff()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var author = await GrantAsync(s, [Permissions.CommunicationsManage]);
        var reviewer = await GrantAsync(s, [Permissions.CommunicationsManage, Permissions.PeopleRead]);
        var (member, person, _) = await s.LinkedApplicantAsync();
        var broadcasts = f.Services.GetRequiredService<BroadcastService>();
        f.As(author);
        var template = await broadcasts.SaveTemplateAsync(s.Parish, null, new SaveBroadcastTemplateDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated HTTP template", Title = "Isolated HTTP title", Body = "Isolated HTTP body", Language = "en"
        }, default);
        var draft = await broadcasts.SaveAsync(s.Parish, null, new SaveBroadcastDto
        {
            OperationId = Guid.NewGuid(), Audience = "Members", Title = "Isolated HTTP broadcast", Body = "Isolated HTTP body", Language = "en"
        }, default);
        f.As(reviewer);
        await broadcasts.TemplateActionAsync(s.Parish, template.Id, new BroadcastActionDto
        {
            OperationId = Guid.NewGuid(), Action = "approve", Version = (await broadcasts.TemplatesAsync(s.Parish, default)).Single().Version
        }, default);
        await broadcasts.ActionAsync(s.Parish, draft.Id, new BroadcastActionDto
        {
            OperationId = Guid.NewGuid(), Action = "approve", Version = (await broadcasts.ListAsync(s.Parish, default)).Single().Version
        }, default);

        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var staff = factory.Client();
        using var parishioner = factory.Client();
        using var visitor = factory.Client();
        var root = $"/api/parishes/{s.Parish}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(root + "/broadcast-automations")).StatusCode);
        await SignInAsync(f, staff, reviewer);
        await SignInAsync(f, parishioner, member);

        // Automations: bounded run limit is validated, a valid one is listed, members are refused without detail.
        var automation = new SaveBroadcastAutomationDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated HTTP automation", TemplateId = Guid.Parse(template.Id), Audience = "Members", Recurrence = "Weekly",
            FirstRunAt = DateTimeOffset.UtcNow.AddDays(1), MaxRuns = 0
        };
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PostAsJsonAsync(root + "/broadcast-automations", automation)).StatusCode);
        automation.MaxRuns = 4;
        var created = await AuthHttp.Read<BroadcastAutomationDto>(await staff.PostAsJsonAsync(root + "/broadcast-automations", automation));
        var listed = Assert.Single(await AuthHttp.Read<List<Versioned<BroadcastAutomationDto>>>(await staff.GetAsync(root + "/broadcast-automations")));
        Assert.Equal((created.Id, "Active", 4), (listed.Value.Id, listed.Value.Status, listed.Value.MaxRuns));
        var pause = new BroadcastAutomationActionDto { OperationId = Guid.NewGuid(), Version = listed.Version, Action = "pause" };
        Assert.Equal("Paused", (await AuthHttp.Read<BroadcastAutomationDto>(await staff.PostAsJsonAsync($"{root}/broadcast-automations/{created.Id}/actions", pause))).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await parishioner.GetAsync(root + "/broadcast-automations")).StatusCode);

        // Schedule: an unknown action is refused by validation; a valid UTC time schedules the approved broadcast.
        var version = Assert.Single(await AuthHttp.Read<List<Versioned<BroadcastDto>>>(await staff.GetAsync(root + "/broadcasts"))).Version;
        var schedule = new BroadcastActionDto { OperationId = Guid.NewGuid(), Version = version, Action = "deliver", ScheduledFor = DateTimeOffset.UtcNow.AddHours(1) };
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PostAsJsonAsync($"{root}/broadcasts/{draft.Id}/actions", schedule)).StatusCode);
        schedule.Action = "schedule";
        var scheduled = await AuthHttp.Read<BroadcastDto>(await staff.PostAsJsonAsync($"{root}/broadcasts/{draft.Id}/actions", schedule));
        Assert.Equal("Scheduled", scheduled.Status);
        Assert.All(scheduled.Channels, c => Assert.NotEqual("Stored", c.Status));

        // Person route: staff with people.read reach the person's linked account; a member cannot.
        var start = new StartConversationDto { OperationId = Guid.NewGuid(), Subject = "Isolated HTTP subject", Body = "Isolated HTTP body", RecipientPersonId = Guid.Parse(person) };
        Assert.Equal(HttpStatusCode.NotFound, (await parishioner.PostAsJsonAsync(root + "/inbox", start)).StatusCode);
        start.OperationId = Guid.NewGuid();
        var direct = await AuthHttp.Read<ConversationDto>(await staff.PostAsJsonAsync(root + "/inbox", start));
        Assert.Equal(("Direct", reviewer), (direct.Kind, direct.CreatedBy));
        Assert.Contains(member, direct.ParticipantAccountIds);
    }

    private static async Task SignInAsync(LocalBackendFixture f, HttpClient client, string account)
        => await AuthHttp.LoginAsync(client, (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(account))!.UserName!);

    private static async Task<string> GrantAsync(MinistryScenario s, string[] allows)
    {
        var account = await s.Fixture.CreateVerifiedStaffAsync();
        s.Fixture.As(s.Fixture.FirstAdmin);
        await s.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(account), Allows = allows, StartsAt = s.Fixture.Clock.Now
        }, default);
        return account;
    }
}
