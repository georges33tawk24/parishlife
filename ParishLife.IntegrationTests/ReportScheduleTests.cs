// Purpose: verifies scheduled report delivery (W04) through the real local services, worker processor and storage.
// Main tests: a due run stores exactly one in-app snapshot and notice per due time, limited to the recipient's current queues, with email
// recorded as not configured; lost access yields a contentless NotAuthorized run, pauses the schedule and hides earlier snapshots; personal
// capacity, MFA and ownership are enforced; inputs, versions, replay and pause/resume/cancel transitions are validated.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Reporting;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class ReportScheduleTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario S, string Clerk);

    private static async Task<Setup> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        Assert.StartsWith(Path.GetTempPath(), f.DirectoryPath);
        var s = await StaffAppointmentScenario.CreateAsync(f);
        await s.ActivateOfficeAsync(["core", "office", "requests"]);
        var clerk = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(clerk), Allows = [Permissions.RequestsManage], StartsAt = f.Clock.Now
        }, default);
        await f.Services.GetRequiredService<RequestService>().GuestSubmitAsync(s.Parish, new GuestRequestDto
        {
            OperationId = Guid.NewGuid(), Kind = "Blessing", Summary = "Private blessing summary", Details = new() { ["address"] = "Isolated street" },
            RequesterName = "Isolated guest", RequesterContact = "guest@fixture.example", SubjectDescription = "Our new home"
        }, default);
        return new Setup(f, s, clerk);
    }

    private static ReportScheduleService Schedules(LocalBackendFixture f) => f.Services.GetRequiredService<ReportScheduleService>();
    private static ReportScheduleProcessor Runner(LocalBackendFixture f) => f.Services.GetRequiredService<ReportScheduleProcessor>();

    private static CreateReportScheduleDto Daily(string parish, bool email = false) => new()
    {
        OperationId = Guid.NewGuid(), Report = "work-overview", ParishId = Guid.Parse(parish), Frequency = "Daily", LocalHour = 7, TimeZone = "UTC", Email = email
    };

    [Fact]
    public async Task A_due_run_stores_one_in_app_snapshot_of_the_recipients_current_queues()
    {
        var x = await StartAsync();
        await using var _ = x.F;
        var f = x.F;
        f.As(x.Clerk);
        var request = Daily(x.S.Parish, email: true);
        var created = await Schedules(f).CreateAsync(request, default);
        Assert.Equal(created.Value.Id, (await Schedules(f).CreateAsync(request, default)).Value.Id);
        // Clock is 2026-11-03 12:00Z, so the next 07:00 UTC is the following morning.
        Assert.Equal(new DateTimeOffset(2026, 11, 4, 7, 0, 0, TimeSpan.Zero), created.Value.NextRunAt);
        Assert.Equal("NotConfigured", created.Value.EmailStatus);

        Assert.False(await Runner(f).RunAsync(x.Clerk, created.Value.Id, default));
        f.Clock.Now = created.Value.NextRunAt.AddMinutes(3);
        Assert.True(await Runner(f).RunAsync(x.Clerk, created.Value.Id, default));
        Assert.False(await Runner(f).RunAsync(x.Clerk, created.Value.Id, default));

        f.As(x.Clerk);
        var delivery = Assert.Single((await Schedules(f).DeliveriesAsync(25, null, default)).Items);
        Assert.Equal(("StoredInApp", "Email", "NotConfigured"), (delivery.Status, delivery.ExternalChannel, delivery.ExternalStatus));
        Assert.Empty(delivery.Counts);
        var detail = await Schedules(f).DeliveryAsync(delivery.Id, default);
        var count = Assert.Single(detail.Counts);
        Assert.Equal(("Open requests", 1), (count.Queue, count.Count));
        var json = System.Text.Json.JsonSerializer.Serialize(detail);
        Assert.DoesNotContain("Private blessing summary", json);
        Assert.DoesNotContain("guest@fixture.example", json);

        var schedule = await Schedules(f).GetAsync(created.Value.Id, default);
        Assert.Equal(new DateTimeOffset(2026, 11, 5, 7, 0, 0, TimeSpan.Zero), schedule.Value.NextRunAt);
        var notice = Assert.Single((await f.Services.GetRequiredService<NotificationService>().ListAsync(null, 25, null, default)).Items, n => n.Topic == "reports");
        Assert.Equal("/api/report-deliveries/" + delivery.Id, notice.Link);

        // Another account sees neither the schedule nor the snapshot.
        f.As(f.Other);
        await Assert.ThrowsAsync<DomainException>(() => Schedules(f).DeliveryAsync(delivery.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => Schedules(f).GetAsync(created.Value.Id, default));
        Assert.Empty((await Schedules(f).DeliveriesAsync(25, null, default)).Items);
    }

    [Fact]
    public async Task Lost_access_produces_a_contentless_run_pauses_the_schedule_and_hides_old_snapshots()
    {
        var x = await StartAsync();
        await using var _ = x.F;
        var f = x.F;
        f.As(x.Clerk);
        var created = await Schedules(f).CreateAsync(Daily(x.S.Parish), default);
        f.Clock.Now = created.Value.NextRunAt;
        Assert.True(await Runner(f).RunAsync(x.Clerk, created.Value.Id, default));
        f.As(x.Clerk);
        var first = Assert.Single((await Schedules(f).DeliveriesAsync(25, null, default)).Items);

        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().RevokeAsync(x.S.Parish, new RevokeAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.S.Parishes.GetAsync(x.S.Parish, default))!.Version, AccountId = Guid.Parse(x.Clerk), Reason = "Left the office"
        }, default);
        f.Clock.Now = f.Clock.Now.AddDays(1);
        Assert.True(await Runner(f).RunAsync(x.Clerk, created.Value.Id, default));

        f.As(x.Clerk);
        var runs = (await Schedules(f).DeliveriesAsync(25, null, default)).Items;
        var refused = Assert.Single(runs, d => d.Id != first.Id);
        Assert.Equal("NotAuthorized", refused.Status);
        Assert.Empty((await Schedules(f).DeliveryAsync(refused.Id, default)).Counts);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Schedules(f).DeliveryAsync(first.Id, default))).Kind);
        var paused = await Schedules(f).GetAsync(created.Value.Id, default);
        Assert.Equal("Paused", paused.Value.Status);
        Assert.Contains((await f.Services.GetRequiredService<NotificationService>().ListAsync(null, 25, null, default)).Items, n => n.Kind == "Required" && n.Topic == "reports");
        // Paused schedules never run, and resuming needs the access back.
        f.Clock.Now = f.Clock.Now.AddDays(2);
        Assert.False(await Runner(f).RunAsync(x.Clerk, created.Value.Id, default));
        f.As(x.Clerk);
        await Assert.ThrowsAsync<DomainException>(() => Schedules(f).ActAsync(created.Value.Id, Act("resume", paused.Version), default));
    }

    [Fact]
    public async Task Capacity_mfa_access_and_inputs_are_enforced()
    {
        var x = await StartAsync();
        await using var _ = x.F;
        var f = x.F;
        foreach (var denied in new Action[] { () => f.As(x.Clerk, mfa: false), () => f.AsRecovery(x.Clerk), () => f.AsAppointment(x.Clerk, Guid.NewGuid().ToString("N")) })
        {
            denied();
            Assert.Equal(FailureKind.Forbidden, (await Assert.ThrowsAsync<DomainException>(() => Schedules(f).CreateAsync(Daily(x.S.Parish), default))).Kind);
            await Assert.ThrowsAsync<DomainException>(() => Schedules(f).DeliveriesAsync(25, null, default));
        }
        // An account without any queue in the parish cannot schedule its report.
        f.As(f.Other);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Schedules(f).CreateAsync(Daily(x.S.Parish), default))).Kind);

        f.As(x.Clerk);
        async Task Refuse(Action<CreateReportScheduleDto> change)
        {
            var request = Daily(x.S.Parish);
            change(request);
            Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => Schedules(f).CreateAsync(request, default))).Code);
        }
        await Refuse(r => r.Report = "giving");
        await Refuse(r => r.Frequency = "Hourly");
        await Refuse(r => r.Frequency = "Weekly");
        await Refuse(r => r.DayOfWeek = "Monday");
        await Refuse(r => { r.Frequency = "Weekly"; r.DayOfWeek = "Funday"; });
        await Refuse(r => r.TimeZone = "Mars/Olympus");
        await Refuse(r => r.LocalHour = 24);

        var weekly = Daily(x.S.Parish);
        weekly.Frequency = "Weekly";
        weekly.DayOfWeek = "Monday";
        weekly.TimeZone = "Asia/Beirut";
        // Tuesday 2026-11-03: the next Monday 07:00 in Beirut (UTC+2) is 2026-11-09 05:00Z.
        Assert.Equal(new DateTimeOffset(2026, 11, 9, 5, 0, 0, TimeSpan.Zero), (await Schedules(f).CreateAsync(weekly, default)).Value.NextRunAt);
    }

    [Fact]
    public async Task Actions_need_the_current_version_replay_exactly_and_follow_the_lifecycle()
    {
        var x = await StartAsync();
        await using var _ = x.F;
        var f = x.F;
        f.As(x.Clerk);
        var created = await Schedules(f).CreateAsync(Daily(x.S.Parish), default);
        var pause = Act("pause", created.Version);
        var paused = await Schedules(f).ActAsync(created.Value.Id, pause, default);
        Assert.Equal(paused.Version, (await Schedules(f).ActAsync(created.Value.Id, pause, default)).Version);
        Assert.Equal("Paused", paused.Value.Status);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => Schedules(f).ActAsync(created.Value.Id, Act("resume", created.Version), default))).Code);
        Assert.Equal("invalid_state", (await Assert.ThrowsAsync<DomainException>(() => Schedules(f).ActAsync(created.Value.Id, Act("pause", paused.Version), default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => Schedules(f).ActAsync(created.Value.Id, Act("delete", paused.Version), default))).Code);

        f.Clock.Now = f.Clock.Now.AddDays(3);
        var resumed = await Schedules(f).ActAsync(created.Value.Id, Act("resume", paused.Version), default);
        Assert.Equal(("Active", new DateTimeOffset(2026, 11, 7, 7, 0, 0, TimeSpan.Zero)), (resumed.Value.Status, resumed.Value.NextRunAt));
        var cancelled = await Schedules(f).ActAsync(created.Value.Id, Act("cancel", resumed.Version), default);
        Assert.Equal("Cancelled", cancelled.Value.Status);
        Assert.Equal("invalid_state", (await Assert.ThrowsAsync<DomainException>(() => Schedules(f).ActAsync(created.Value.Id, Act("resume", cancelled.Version), default))).Code);
        f.Clock.Now = f.Clock.Now.AddDays(2);
        Assert.False(await Runner(f).RunAsync(x.Clerk, created.Value.Id, default));
        Assert.Null(await Runner(f).ProcessPageAsync(null, default));
    }

    private static ReportScheduleActionDto Act(string action, string version) => new() { OperationId = Guid.NewGuid(), Action = action, Version = version };
}
