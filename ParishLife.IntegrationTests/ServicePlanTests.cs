// Purpose: verifies service plans, templates, audience outputs and the music library (S17) through real local services and storage.
// Main tests: blocking issues and priest-only review; audience-specific outputs and music rights; template copying without people;
// immutable music versions pinned by plans, withdrawal and search.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class ServicePlanTests
{
    private sealed record Setup(LocalBackendFixture F, SchedulingScenario S, string Planner, CalendarEventDto Event)
    {
        public ServicePlanService Plans => F.Services.GetRequiredService<ServicePlanService>();
        public MusicLibraryService Music => F.Services.GetRequiredService<MusicLibraryService>();
        public string Parish => S.Parish;
    }

    [Fact]
    public async Task Blocking_issues_stop_submission_and_only_a_priest_approves()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Planner);
        var plan = await x.Plans.SaveAsync(x.Parish, null, Request(x, [Item("entrance", 10, required: true), Item("homily", 20), Item("closing", 10)]), default);
        Assert.Contains("UnassignedRole:entrance", plan.Issues);
        Assert.Contains("CelebrantRequired", plan.Issues);
        Assert.Equal("plan_has_blocking_issues", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, plan.Id, "submit"))).Code);

        var overtime = Request(x, [Item("entrance", 50, assigned: f.Other), Item("homily", 20)], celebrant: f.Other);
        overtime.Version = await VersionAsync(x, plan.Id);
        Assert.Equal(["Overtime"], (await x.Plans.SaveAsync(x.Parish, plan.Id, overtime, default)).Issues);

        var good = Request(x, [Item("entrance", 10, assigned: f.Other), Item("homily", 20), Item("closing", 10, fixedStart: x.Event.StartsAt.AddMinutes(45))], celebrant: f.Other);
        good.Version = await VersionAsync(x, plan.Id);
        var fixedPlan = await x.Plans.SaveAsync(x.Parish, plan.Id, good, default);
        Assert.Empty(fixedPlan.Issues);
        Assert.Equal(x.Event.StartsAt.AddMinutes(45), fixedPlan.Items.Single(i => i.Key == "closing").StartsAt);
        await ActAsync(x, plan.Id, "submit");
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, plan.Id, "approve"));
        x.S.Use();
        Assert.Equal("Returned", (await ActAsync(x, plan.Id, "return", "Add the closing hymn")).Status);
        f.As(x.Planner);
        await ActAsync(x, plan.Id, "submit");
        x.S.Use();
        Assert.Equal("Approved", (await ActAsync(x, plan.Id, "approve")).Status);
        f.As(x.Planner);
        var edit = Request(x, [Item("entrance", 5, assigned: f.Other)], celebrant: f.Other);
        edit.Version = await VersionAsync(x, plan.Id);
        await Assert.ThrowsAsync<DomainException>(() => x.Plans.SaveAsync(x.Parish, plan.Id, edit, default));
    }

    [Fact]
    public async Task Outputs_show_each_audience_only_its_instructions_and_music_text_only_with_print_rights()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var printable = await PublishAsync(x, "Gloria", print: true);
        var restricted = await PublishAsync(x, "Sanctus", print: false);
        f.As(x.Planner);
        var plan = await x.Plans.SaveAsync(x.Parish, null, Request(x,
        [
            Item("gloria", 5, music: printable.Id, instructions: "Choir stands", audience: "Team"),
            Item("homily", 15, instructions: "Private pastoral reminder", audience: "Clergy"),
            Item("sanctus", 5, music: restricted.Id, instructions: "Please kneel", audience: "Everyone", assigned: f.Other)
        ], celebrant: f.Other), default);
        await ActAsync(x, plan.Id, "submit");
        x.S.Use();
        await ActAsync(x, plan.Id, "approve");

        var clergy = await x.Plans.OutputAsync(x.Parish, plan.Id, "clergy", default);
        Assert.Equal("Private pastoral reminder", clergy.Items.Single(i => i.Title == "homily").Instructions);
        var team = await x.Plans.OutputAsync(x.Parish, plan.Id, "team", default);
        Assert.Null(team.Items.Single(i => i.Title == "homily").Instructions);
        Assert.Equal("Choir stands", team.Items.Single(i => i.Title == "gloria").Instructions);
        var participants = await x.Plans.OutputAsync(x.Parish, plan.Id, "participants", default);
        Assert.All(participants.Items, i => Assert.Null(i.AssignedAccountId));
        Assert.Null(participants.Items.Single(i => i.Title == "gloria").Instructions);
        Assert.Equal("Please kneel", participants.Items.Single(i => i.Title == "sanctus").Instructions);
        var musicians = await x.Plans.OutputAsync(x.Parish, plan.Id, "musicians", default);
        Assert.Equal(2, musicians.Items.Length);
        Assert.Contains("Gloria lyrics", musicians.Items.Single(i => i.MusicTitle == "Gloria").MusicText);
        Assert.Null(musicians.Items.Single(i => i.MusicTitle == "Sanctus").MusicText);
    }

    [Fact]
    public async Task Templates_copy_structure_without_people_and_never_change_saved_plans()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Planner);
        var withPeople = Request(x, [Item("entrance", 10, assigned: f.Other)]);
        withPeople.EventId = null;
        await Assert.ThrowsAsync<DomainException>(() => x.Plans.SaveAsync(x.Parish, null, withPeople, default));
        var template = Request(x, [Item("entrance", 10, required: true, instructions: "Ring the bell", audience: "Team"), Item("closing", 5)]);
        template.EventId = null;
        template.PlanType = "Activity";
        var saved = await x.Plans.SaveAsync(x.Parish, null, template, default);
        Assert.Equal("Template", saved.Kind);
        var copyRequest = Request(x, []);
        copyRequest.PlanType = "Activity";
        copyRequest.TemplateId = Guid.Parse(saved.Id);
        await Assert.ThrowsAsync<DomainException>(() => x.Plans.SaveAsync(x.Parish, null, copyRequest, default));
        await ActAsync(x, saved.Id, "submit");
        x.S.Use();
        await ActAsync(x, saved.Id, "approve");

        f.As(x.Planner);
        copyRequest.OperationId = Guid.NewGuid();
        var copy = await x.Plans.SaveAsync(x.Parish, null, copyRequest, default);
        Assert.Equal(saved.Id, copy.TemplateId);
        Assert.Equal("Ring the bell", copy.Items.Single(i => i.Key == "entrance").Instructions);
        Assert.Null(copy.Items.Single(i => i.Key == "entrance").AssignedAccountId);
        Assert.Contains("UnassignedRole:entrance", copy.Issues);
        Assert.Single((await x.Plans.ListAsync(x.Parish, null, 25, null, default)).Items);
        Assert.Single((await x.Plans.ListAsync(x.Parish, x.Event.Id, 25, null, default)).Items);
    }

    [Fact]
    public async Task Music_versions_are_immutable_pinned_withdrawable_and_searchable()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Planner);
        await Assert.ThrowsAsync<DomainException>(() => x.Music.PublishAsync(x.Parish, Music("Unauthorized", true), default));
        var first = await PublishAsync(x, "Salve Regina", print: true);
        x.S.Use();
        var bad = Music("Bad link", true);
        bad.MediaLinks = ["http://insecure.example/track"];
        await Assert.ThrowsAsync<DomainException>(() => x.Music.PublishAsync(x.Parish, bad, default));
        var revision = Music("Salve Regina (revised)", true);
        revision.SupersedesId = Guid.Parse(first.Id);
        var second = await x.Music.PublishAsync(x.Parish, revision, default);
        Assert.Equal(first.WorkId, second.WorkId);
        Assert.Equal("Superseded", (await x.Music.GetAsync(x.Parish, first.Id, default)).Value.Status);
        // Only the active version of a work can be revised.
        await Assert.ThrowsAsync<DomainException>(() => PublishAgain(x, first.Id));

        f.As(x.Planner);
        var plan = await x.Plans.SaveAsync(x.Parish, null, Request(x, [Item("anthem", 5, music: first.Id)], celebrant: f.Other), default);
        Assert.Empty(plan.Issues);
        x.S.Use();
        await x.Music.WithdrawAsync(x.Parish, first.Id, new WithdrawMusicDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Music.GetAsync(x.Parish, first.Id, default)).Version, Reason = "Licence expired"
        }, default);
        var withdrawn = (await x.Music.GetAsync(x.Parish, first.Id, default)).Value;
        Assert.Null(withdrawn.Lyrics);
        Assert.False(withdrawn.PrintAllowed);
        Assert.Contains("MusicUnavailable:anthem", (await x.Plans.GetAsync(x.Parish, plan.Id, default)).Value.Issues);

        await PublishAsync(x, "Ave Maria", print: false, language: "la");
        x.S.Use();
        Assert.Equal(["Ave Maria", "Salve Regina (revised)"], (await x.Music.SearchAsync(x.Parish, null, null, null, null, false, 25, 0, default)).Items.Select(m => m.Title));
        Assert.Equal("Ave Maria", Assert.Single((await x.Music.SearchAsync(x.Parish, "ave", "la", null, null, false, 25, 0, default)).Items).Title);
        Assert.Equal(3, (await x.Music.SearchAsync(x.Parish, null, null, null, null, true, 25, 0, default)).Items.Count);
    }

    private static Task PublishAgain(Setup x, string superseded)
    {
        var again = Music("Second revision of the old version", true);
        again.SupersedesId = Guid.Parse(superseded);
        return x.Music.PublishAsync(x.Parish, again, default);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows:
            [Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.SchedulePublish, Permissions.MusicManage]));
        var scheduling = new SchedulingScenario(staff, appointment.Id);
        var planner = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(planner), Allows = [Permissions.ScheduleRead, Permissions.ScheduleManage], StartsAt = f.Clock.Now
        }, default);
        var occurrence = await scheduling.EventAsync(f.Clock.Now.AddDays(3));
        return new Setup(f, scheduling, planner, occurrence);
    }

    private static SavePlanDto Request(Setup x, PlanItemDto[] items, string? celebrant = null) => new()
    {
        OperationId = Guid.NewGuid(), EventId = Guid.Parse(x.Event.Id), Title = "Isolated Sunday plan", PlanType = "Liturgy",
        CoordinatorAccountId = Guid.Parse(x.Planner), CelebrantAccountId = celebrant is null ? null : Guid.Parse(celebrant), Items = items
    };

    private static PlanItemDto Item(string key, int minutes, bool required = false, string? assigned = null, string? music = null,
        string? instructions = null, string audience = "Clergy", DateTimeOffset? fixedStart = null) => new()
    {
        Key = key, Title = key, Minutes = minutes, Required = required, ResponsibleRole = required ? "Cantor" : null,
        AssignedAccountId = assigned is null ? null : Guid.Parse(assigned), MusicVersionId = music is null ? null : Guid.Parse(music),
        Instructions = instructions, InstructionAudience = audience, FixedStart = fixedStart
    };

    private static PublishMusicDto Music(string title, bool print, string language = "en") => new()
    {
        OperationId = Guid.NewGuid(), Title = title, Language = language, Lyrics = title + " lyrics", Chords = "C G Am F",
        RightsBasis = "Isolated licence record", Attribution = "Isolated publisher", PrintAllowed = print, ProjectionAllowed = print,
        MediaLinks = ["https://media.example/" + Guid.NewGuid().ToString("N")]
    };

    private static async Task<MusicVersionDto> PublishAsync(Setup x, string title, bool print, string language = "en")
    {
        x.S.Use();
        return await x.Music.PublishAsync(x.Parish, Music(title, print, language), default);
    }

    private static async Task<ServicePlanDto> ActAsync(Setup x, string plan, string action, string? reason = null)
        => await x.Plans.ActAsync(x.Parish, plan, new PlanActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync(x, plan), Action = action, Reason = reason }, default);

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync(Setup x, string plan)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<ServicePlan>(
            new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "servicePlan:" + plan, default))!.Version;
}
