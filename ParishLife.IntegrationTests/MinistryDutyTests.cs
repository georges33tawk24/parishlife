// Purpose: verifies explicit attendance/privacy delegation without turning ordinary ministry management into sensitive access.
// Main tests: delegator capability limits, review-only isolation, duty removal, retained appointment dates and explicit denial.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryDutyTests
{
    [Fact]
    public async Task Ministry_management_cannot_delegate_attendance_or_private_reasons_it_does_not_hold()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var group = await s.MinistryAsync();
        var account = await f.CreateVerifiedStaffAsync();
        s.Use();
        var service = f.Services.GetRequiredService<MinistryLeadershipService>();
        foreach (var duty in new[] { "attendance.record", "attendance.review", "rsvp.private.read" })
        {
            var request = await Request(s, group.Id, account, [duty]);
            s.Use();
            await Assert.ThrowsAsync<DomainException>(() => service.AppointAsync(s.Parish, group.Id, request, default));
        }
        var ordinary = await Request(s, group.Id, account, []);
        s.Use();
        Assert.Empty((await service.AppointAsync(s.Parish, group.Id, ordinary, default)).Duties);
        f.As(account);
        var access = f.Services.GetRequiredService<MinistryAccess>();
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAttendanceAsync(s.Parish, group.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => access.RequireRsvpReasonReaderAsync(s.Parish, group.Id, default));
    }

    [Fact]
    public async Task Review_only_authority_can_read_and_review_but_never_records_or_reads_private_RSVP_reasons()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties:
            [Permissions.MinistriesAttendanceRecord, Permissions.MinistriesAttendanceReview]);
        var group = await s.MinistryAsync();
        var account = await f.CreateVerifiedStaffAsync();
        var request = await Request(s, group.Id, account, ["attendance.review"]);
        s.Use();
        await f.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, group.Id, request, default);
        f.As(account);
        var access = f.Services.GetRequiredService<MinistryAccess>();
        Assert.Equal(group.Id, (await access.RequireAttendanceAsync(s.Parish, group.Id, default, readOnly: true)).Value.Id);
        Assert.Equal(group.Id, (await access.RequireAttendanceAsync(s.Parish, group.Id, default, review: true)).Value.Id);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAttendanceAsync(s.Parish, group.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => access.RequireRsvpReasonReaderAsync(s.Parish, group.Id, default));
    }

    [Fact]
    public async Task Removing_a_duty_keeps_the_appointment_interval_and_stops_that_duty_on_the_next_check()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesAttendanceRecord]);
        var group = await s.MinistryAsync();
        var account = await f.CreateVerifiedStaffAsync();
        var request = await Request(s, group.Id, account, ["attendance.record"]);
        s.Use();
        var service = f.Services.GetRequiredService<MinistryLeadershipService>();
        var leader = await service.AppointAsync(s.Parish, group.Id, request, default);
        f.As(account);
        var access = f.Services.GetRequiredService<MinistryAccess>();
        await access.RequireAttendanceAsync(s.Parish, group.Id, default);
        s.Use();
        var row = await service.GetAsync(s.Parish, group.Id, account, default);
        var change = new ChangeMinistryLeaderDutiesDto
        { OperationId = Guid.NewGuid(), Version = row.Version, Duties = [], EvidenceReference = "Actual duty review evidence", Reason = "Actual removal instruction" };
        var changed = await service.ChangeDutiesAsync(s.Parish, group.Id, account, change, default);
        Assert.Equal(leader.Id, changed.Id);
        Assert.Equal(leader.StartsAt, changed.StartsAt);
        Assert.Equal(leader.EndsAt, changed.EndsAt);
        Assert.True(changed.Effective);
        Assert.Empty(changed.Duties);
        f.As(account);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireAttendanceAsync(s.Parish, group.Id, default));
        s.Use();
        Assert.Empty((await service.ChangeDutiesAsync(s.Parish, group.Id, account, change, default)).Duties);
        Assert.Contains((await service.HistoryAsync(s.Parish, group.Id, account, 25, null, default)).Items,
            item => item.Action == "DutiesChanged" && item.EvidenceReference == change.EvidenceReference && item.Reason == change.Reason);
    }

    [Fact]
    public async Task Explicit_attendance_denial_survives_an_otherwise_current_leader_duty()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesAttendanceRecord]);
        var group = await s.MinistryAsync();
        var account = await f.CreateVerifiedStaffAsync();
        var request = await Request(s, group.Id, account, ["attendance.record"]);
        s.Use();
        await f.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, group.Id, request, default);
        f.As(f.FirstAdmin);
        // Isolated persisted denial fixture tests the read boundary without giving setup owners automatic sensitive duties.
        await s.Staff.Parishes.GrantAsync(s.Parish, (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            new AccessGrant
            {
                AccountId = account,
                Allows = [Permissions.PeopleRead],
                Denies = [Permissions.MinistriesAttendanceRecord],
                StartsAt = f.Clock.Now,
                GrantedBy = f.FirstAdmin
            },
            Operation.Create(Guid.NewGuid(), f.FirstAdmin, new { deny = account }, f.Clock), default);
        f.As(account);
        await Assert.ThrowsAsync<DomainException>(() => f.Services.GetRequiredService<MinistryAccess>().RequireAttendanceAsync(s.Parish, group.Id, default));
    }

    private static async Task<AppointLeaderDto> Request(MinistryScenario s, string group, string account, string[] duties)
    {
        s.Use();
        return new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(),
            MinistryVersion = (await s.Ministries.GetAsync(s.Parish, group, default)).Version,
            AccountId = Guid.Parse(account),
            Role = "Leader",
            Duties = duties,
            StartsAt = s.Fixture.Clock.Now,
            EndsAt = s.Fixture.Clock.Now.AddDays(4),
            EvidenceReference = "Actual isolated scoped appointment"
        };
    }
}
