// Purpose: verifies Arabic title/description twins on calendar events and the parish's reusable event templates through real local services, storage and HTTP.
// Main tests: Arabic twins stored as typed, redacted for busy intervals, copied into series and the public projection; templates created, edited,
// archived and restored under versions with draft audience rules, replay and permission denials; the templates and celebrants routes over HTTP.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CalendarTemplateTests
{
    [Fact]
    public async Task Calendar_events_keep_arabic_twins_as_typed_and_hide_them_in_busy_intervals()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(f);
        var reader = await GrantAsync(s, [Permissions.ScheduleRead]);
        s.Use();
        var when = f.Clock.Now.AddDays(2);
        var saved = await s.Calendar.SaveAsync(s.Parish, null, Event("Isolated vespers", "صلاة الغروب", when, "Public", descriptionAr: "تفاصيل"), default);
        Assert.Equal(("صلاة الغروب", "تفاصيل"), (saved.TitleAr, saved.DescriptionAr));
        Assert.Equal("Isolated vespers", saved.Title);

        // Blank twins are not stored, and the English title is never copied into the Arabic one.
        var englishOnly = await s.Calendar.SaveAsync(s.Parish, null, Event("Isolated English only", "   ", when.AddDays(1), "Parish"), default);
        Assert.Null(englishOnly.TitleAr);
        Assert.Null(englishOnly.DescriptionAr);

        var series = await s.Calendar.CreateSeriesAsync(s.Parish, new CreateSeriesDto
        {
            OperationId = Guid.NewGuid(), Title = "Isolated choir", TitleAr = "الجوقة", Kind = "ParishActivity", StartsAt = when, EndsAt = when.AddHours(1),
            TimeZone = "UTC", Visibility = "Parish", DescriptionAr = "تمرين", Count = 3, IntervalDays = 7
        }, default);
        Assert.All(series, item => Assert.Equal(("الجوقة", "تمرين"), (item.TitleAr, item.DescriptionAr)));

        var hidden = await s.Calendar.SaveAsync(s.Parish, null, Event("Isolated private meeting", "اجتماع خاص", when.AddHours(3), "Private", "Appointment", "سري"), default);
        f.As(reader);
        var busy = (await s.Calendar.GetAsync(s.Parish, hidden.Id, default)).Value;
        Assert.True(busy.Redacted);
        Assert.Null(busy.TitleAr);
        Assert.Null(busy.DescriptionAr);
        Assert.Equal("صلاة الغروب", (await s.Calendar.GetAsync(s.Parish, saved.Id, default)).Value.TitleAr);

        s.Use();
        var row = await s.Calendar.GetAsync(s.Parish, saved.Id, default);
        await s.Calendar.ActAsync(s.Parish, saved.Id, new EventActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "confirm" }, default);
        row = await s.Calendar.GetAsync(s.Parish, saved.Id, default);
        await s.Calendar.ActAsync(s.Parish, saved.Id, new EventActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "publish" }, default);
        var shown = Assert.Single((await s.Calendar.PublicAsync(s.Parish, when.AddHours(-1), when.AddHours(2), 25, null, default)).Items);
        Assert.Equal(("صلاة الغروب", "تفاصيل"), (shown.TitleAr, shown.DescriptionAr));
    }

    [Fact]
    public async Task Event_templates_are_versioned_archived_and_restored_with_draft_audience_rules_and_permissions()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(f);
        var reader = await GrantAsync(s, [Permissions.ScheduleRead]);
        var outsider = await f.CreateVerifiedStaffAsync();
        var templates = f.Services.GetRequiredService<EventTemplateService>();

        s.Use();
        var request = Template("Isolated parish lunch", "غداء الرعية");
        var created = await templates.SaveAsync(s.Parish, null, request, default);
        Assert.Equal(("Isolated parish lunch", "غداء الرعية", "Active", "12:30", 90), (created.Value.Name, created.Value.NameAr, created.Value.Status, created.Value.StartTime, created.Value.DurationMinutes));
        // Replaying the same operation returns the stored template instead of a second one.
        Assert.Equal(created.Value.Id, (await templates.SaveAsync(s.Parish, null, request, default)).Value.Id);
        Assert.Single((await templates.ListAsync(s.Parish, false, 25, null, default)).Items);

        var edit = Template("Isolated parish lunch (hall)", null);
        edit.Version = created.Version;
        var edited = await templates.SaveAsync(s.Parish, created.Value.Id, edit, default);
        Assert.Null(edited.Value.NameAr);
        var stale = Template("Stale edit", null);
        stale.Version = created.Version;
        await Assert.ThrowsAnyAsync<Exception>(() => templates.SaveAsync(s.Parish, created.Value.Id, stale, default));

        var bad = Template("Isolated appointment", null);
        bad.Kind = "Appointment";
        bad.Visibility = "Public";
        Assert.Equal("invalid_visibility", (await Assert.ThrowsAsync<DomainException>(() => templates.SaveAsync(s.Parish, null, bad, default))).Code);
        var official = Template("Isolated official", null);
        official.Kind = "Mass";
        Assert.Equal("source_command_required", (await Assert.ThrowsAsync<DomainException>(() => templates.SaveAsync(s.Parish, null, official, default))).Code);

        var archived = await templates.ActAsync(s.Parish, created.Value.Id, Action(edited.Version, "archive"), default);
        Assert.Equal("Archived", archived.Value.Status);
        Assert.Empty((await templates.ListAsync(s.Parish, false, 25, null, default)).Items);
        Assert.Single((await templates.ListAsync(s.Parish, true, 25, null, default)).Items);
        var archivedEdit = Template("Edit while archived", null);
        archivedEdit.Version = archived.Version;
        Assert.Equal("invalid_template_state", (await Assert.ThrowsAsync<DomainException>(() => templates.SaveAsync(s.Parish, created.Value.Id, archivedEdit, default))).Code);
        Assert.Equal("invalid_template_state", (await Assert.ThrowsAsync<DomainException>(() => templates.ActAsync(s.Parish, created.Value.Id, Action(archived.Version, "archive"), default))).Code);
        Assert.Equal("Active", (await templates.ActAsync(s.Parish, created.Value.Id, Action(archived.Version, "restore"), default)).Value.Status);

        // A reader sees templates but cannot change them; an account without schedule access sees nothing.
        f.As(reader);
        Assert.Single((await templates.ListAsync(s.Parish, false, 25, null, default)).Items);
        await Assert.ThrowsAsync<DomainException>(() => templates.SaveAsync(s.Parish, null, Template("Reader attempt", null), default));
        f.As(outsider);
        await Assert.ThrowsAsync<DomainException>(() => templates.ListAsync(s.Parish, false, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => templates.GetAsync(s.Parish, created.Value.Id, default));
    }

    [Fact]
    public async Task Templates_and_celebrant_routes_answer_over_http_only_to_authorized_accounts()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var office = factory.Client();
        using var visitor = factory.Client();
        var root = $"/api/parishes/{s.Parish}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(root + "/calendar/templates")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(root + "/plans/celebrants")).StatusCode);
        await AuthHttp.LoginAsync(office, "other@fixture.example");
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        var created = await AuthHttp.Read<Versioned<EventTemplateDto>>(await office.PostAsJsonAsync(root + "/calendar/templates", Template("Isolated HTTP template", "قالب")));
        Assert.Equal("قالب", created.Value.NameAr);
        var page = await AuthHttp.Read<Page<Versioned<EventTemplateDto>>>(await office.GetAsync(root + "/calendar/templates"));
        Assert.Equal(created.Value.Id, Assert.Single(page.Items).Value.Id);
        Assert.Equal(HttpStatusCode.BadRequest, (await office.PostAsJsonAsync(root + "/calendar/templates", new SaveEventTemplateDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated bad time", Kind = "ParishActivity", Visibility = "Parish", StartTime = "25:00"
        })).StatusCode);
        var archived = await AuthHttp.Read<Versioned<EventTemplateDto>>(await office.PostAsJsonAsync(
            root + "/calendar/templates/" + created.Value.Id + "/actions", Action(created.Version, "archive")));
        Assert.Equal("Archived", archived.Value.Status);
        // The planner (a current priest here) is offered as a celebrant; no other account is invented.
        var celebrants = await AuthHttp.Read<PlanCelebrantDto[]>(await office.GetAsync(root + "/plans/celebrants"));
        Assert.Equal([fixture.Other], celebrants.Select(c => c.AccountId));
    }

    private static SaveEventDto Event(string title, string? titleAr, DateTimeOffset when, string visibility, string kind = "ParishActivity", string? descriptionAr = null) => new()
    {
        OperationId = Guid.NewGuid(), Title = title, TitleAr = titleAr, Kind = kind, StartsAt = when, EndsAt = when.AddHours(1), TimeZone = "UTC",
        Visibility = visibility, Description = "Isolated details", DescriptionAr = descriptionAr
    };

    private static SaveEventTemplateDto Template(string name, string? nameAr) => new()
    {
        OperationId = Guid.NewGuid(), Name = name, NameAr = nameAr, Kind = "ParishActivity", Visibility = "Parish", StartTime = "12:30",
        DurationMinutes = 90, Description = "Isolated template details"
    };

    private static EventTemplateActionDto Action(string version, string action) => new() { OperationId = Guid.NewGuid(), Version = version, Action = action };

    private static async Task<string> GrantAsync(SchedulingScenario s, string[] allows)
    {
        var f = s.Fixture;
        var account = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(account), Allows = allows, StartsAt = f.Clock.Now
        }, default);
        return account;
    }
}
