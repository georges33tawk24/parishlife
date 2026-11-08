// Purpose: verifies actual calendar/privacy, recurrence, resource conflicts, durable compensation and selected-authority withdrawal in isolated persistence.
// Main tests: public lifecycle/source privacy, DST recurrence, competing bookings, buffers/exclusion graphs, cancellation fencing, stale rollback and worker authorization.

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CalendarReservationTests
{
    [Fact]
    public async Task Editing_permission_does_not_publish_and_private_decision_reasons_stay_out_of_general_audit()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var editor = await fixture.CreateVerifiedStaffAsync();
        var role = await s.Staff.AcceptAsync(await s.Staff.InviteAsync(editor, allows: [Permissions.ScheduleRead, Permissions.ScheduleManage]));
        fixture.AsAppointment(editor, role.Id);
        var start = fixture.Clock.Now.AddDays(1);
        var occurrence = await s.Calendar.SaveAsync(s.Parish, null, new SaveEventDto
        {
            OperationId = Guid.NewGuid(),
            Title = "Editor activity",
            Kind = "ParishActivity",
            StartsAt = start,
            EndsAt = start.AddHours(1),
            TimeZone = "UTC",
            Visibility = "Public"
        }, default);
        var row = await s.Calendar.GetAsync(s.Parish, occurrence.Id, default);
        await s.Calendar.ActAsync(s.Parish, occurrence.Id, new EventActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "confirm" }, default);
        row = await s.Calendar.GetAsync(s.Parish, occurrence.Id, default);
        await Assert.ThrowsAsync<DomainException>(() => s.Calendar.ActAsync(s.Parish, occurrence.Id,
            new EventActionDto { OperationId = Guid.NewGuid(), Version = row.Version, Action = "publish" }, default));
        var privateEvent = await s.Calendar.SaveAsync(s.Parish, null, new SaveEventDto
        {
            OperationId = Guid.NewGuid(),
            Title = "Private subject",
            Kind = "Appointment",
            StartsAt = start,
            EndsAt = start.AddHours(1),
            TimeZone = "UTC",
            Visibility = "Private"
        }, default);
        var privateRow = await s.Calendar.GetAsync(s.Parish, privateEvent.Id, default);
        await s.Calendar.ActAsync(s.Parish, privateEvent.Id, new EventActionDto { OperationId = Guid.NewGuid(), Version = privateRow.Version, Action = "cancel", Reason = "Confidential isolated reason" }, default);
        Assert.Equal("Confidential isolated reason", (await s.Calendar.GetAsync(s.Parish, privateEvent.Id, default)).Value.LastActionReason);
        s.Use();
        var redactedCancellation = await s.Calendar.GetAsync(s.Parish, privateEvent.Id, default);
        Assert.True(redactedCancellation.Value.Redacted);
        Assert.Equal("Cancelled", redactedCancellation.Value.Status);
        Assert.Null(redactedCancellation.Value.LastActionReason);
        var audit = await fixture.Services.GetRequiredService<IRecordTransactions>().PageAsync<ParishLife.Api.Data.Cosmos.AuditEntry>(SchedulingScope.For(s.Parish), "audit", 100, null, default);
        Assert.DoesNotContain(audit.Items, entry => entry.Value.Reason?.Contains("Confidential isolated reason", StringComparison.Ordinal) == true);
    }

    [Fact]
    public async Task Calendar_publication_is_explicit_and_linked_reservations_gate_confirmation_and_cancellation()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var occurrence = await s.EventAsync(visibility: "Public");
        var room = await s.FacilityAsync();
        var booking = await s.RequestAsync(occurrence, room.Id);
        Assert.Equal("allocations_pending", (await Assert.ThrowsAsync<DomainException>(() => s.EventActionAsync(occurrence.Id, "confirm"))).Code);
        var queued = await s.ActAsync(booking.Id, "confirm");
        Assert.Equal("Allocating", queued.Status);
        await s.Processor.ProcessOneAsync(s.Parish, queued.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Confirmed", (await s.Reservations.GetAsync(s.Parish, booking.Id, default)).Value.Status);
        await s.EventActionAsync(occurrence.Id, "confirm");
        Assert.Empty((await s.Calendar.PublicAsync(s.Parish, occurrence.StartsAt.AddHours(-1), occurrence.EndsAt.AddHours(1), 25, null, default)).Items);
        await s.EventActionAsync(occurrence.Id, "publish");
        Assert.Equal(occurrence.Title, Assert.Single((await s.Calendar.PublicAsync(s.Parish, occurrence.StartsAt.AddHours(-1), occurrence.EndsAt.AddHours(1), 25, null, default)).Items).Title);
        Assert.Equal("reservations_active", (await Assert.ThrowsAsync<DomainException>(() => s.EventActionAsync(occurrence.Id, "cancel"))).Code);
        await s.ActAsync(booking.Id, "cancel");
        await s.Processor.ProcessOneAsync(s.Parish, queued.CurrentWorkId!, "fixture-worker", default);
        await s.EventActionAsync(occurrence.Id, "cancel");
        Assert.Equal("Cancelled", Assert.Single((await s.Calendar.PublicAsync(s.Parish, occurrence.StartsAt.AddHours(-1), occurrence.EndsAt.AddHours(1), 25, null, default)).Items).Status);
        await s.EventActionAsync(occurrence.Id, "unpublish");
        Assert.Empty((await s.Calendar.PublicAsync(s.Parish, occurrence.StartsAt.AddHours(-1), occurrence.EndsAt.AddHours(1), 25, null, default)).Items);
    }

    [Fact]
    public async Task Private_events_and_bookings_are_busy_only_for_another_staff_account_and_cannot_be_changed()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var occurrence = await s.EventAsync(visibility: "Private", title: "Confidential isolated subject");
        var room = await s.FacilityAsync();
        var booking = await s.RequestAsync(occurrence, room.Id);
        var other = await fixture.CreateVerifiedStaffAsync();
        var role = await s.Staff.AcceptAsync(await s.Staff.InviteAsync(other, allows: [Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.FacilitiesManage]));
        fixture.AsAppointment(other, role.Id);
        var hidden = await s.Calendar.GetAsync(s.Parish, occurrence.Id, default);
        Assert.True(hidden.Value.Redacted);
        Assert.Equal("Busy", hidden.Value.Title);
        Assert.Equal("Busy", hidden.Value.Kind);
        Assert.Null(hidden.Value.Description);
        Assert.Null(hidden.Value.CreatedBy);
        Assert.Empty(hidden.Version);
        var reservation = await s.Reservations.GetAsync(s.Parish, booking.Id, default);
        Assert.True(reservation.Value.Redacted);
        Assert.Null(reservation.Value.EventId);
        Assert.Null(reservation.Value.TermsSnapshot);
        Assert.Empty(reservation.Version);
        await Assert.ThrowsAsync<DomainException>(() => s.Calendar.ActAsync(s.Parish, occurrence.Id,
            new EventActionDto { OperationId = Guid.NewGuid(), Action = "cancel", Version = "unknown", Reason = "Unauthorized private edit" }, default));
        await Assert.ThrowsAsync<DomainException>(() => s.Reservations.ActAsync(s.Parish, booking.Id,
            new ReservationActionDto { OperationId = Guid.NewGuid(), Action = "confirm", Version = "unknown", Reason = "Unauthorized private allocation" }, default));
        Assert.Empty((await s.Calendar.PublicAsync(s.Parish, occurrence.StartsAt.AddHours(-1), occurrence.EndsAt.AddHours(1), 25, null, default)).Items);
    }

    [Fact]
    public async Task Recurrence_preserves_local_wall_time_across_daylight_saving_and_replay_reads_current_occurrences()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        s.Use();
        var request = new CreateSeriesDto
        {
            OperationId = Guid.NewGuid(),
            Title = "Isolated weekly activity",
            Kind = "ParishActivity",
            Visibility = "Parish",
            TimeZone = "America/New_York",
            StartsAt = new DateTimeOffset(2027, 3, 7, 14, 0, 0, TimeSpan.Zero),
            EndsAt = new DateTimeOffset(2027, 3, 7, 15, 0, 0, TimeSpan.Zero),
            Count = 3,
            IntervalDays = 7
        };
        var rows = await s.Calendar.CreateSeriesAsync(s.Parish, request, default);
        Assert.Equal(14, rows[0].StartsAt.Hour);
        Assert.Equal(13, rows[1].StartsAt.Hour);
        Assert.All(rows, row => Assert.Equal(9, TimeZoneInfo.ConvertTime(row.StartsAt, TimeZoneInfo.FindSystemTimeZoneById("America/New_York")).Hour));
        Assert.Equal(rows.Select(row => row.Id), (await s.Calendar.CreateSeriesAsync(s.Parish, request, default)).Select(row => row.Id));
    }

    [Theory]
    [InlineData(3, 7, 7)]
    [InlineData(10, 31, 5)]
    public async Task Missing_or_ambiguous_recurrence_times_fail_without_partial_writes(int month, int day, int hour)
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        s.Use();
        var before = (await s.Staff.Parishes.GetAsync(s.Parish, default))!;
        var start = new DateTimeOffset(2027, month, day, hour, 30, 0, TimeSpan.Zero);
        var error = await Assert.ThrowsAsync<DomainException>(() => s.Calendar.CreateSeriesAsync(s.Parish,
            new CreateSeriesDto
            {
                OperationId = Guid.NewGuid(),
                Title = "DST review fixture",
                Kind = "ParishActivity",
                Visibility = "Parish",
                TimeZone = "America/New_York",
                StartsAt = start,
                EndsAt = start.AddHours(1),
                Count = 2,
                IntervalDays = 7
            }, default));
        Assert.Equal("recurrence_time_requires_review", error.Code);
        Assert.Equal(before.Version, (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version);
        Assert.Empty((await s.Calendar.ListAsync(s.Parish, start.AddDays(-1), start.AddDays(10), 100, null, default)).Items);
    }

    [Fact]
    public async Task Competing_bookings_have_one_confirmed_winner_and_the_other_compensates_without_false_success()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var room = await s.FacilityAsync();
        var first = await s.RequestAsync(await s.EventAsync(), room.Id);
        var second = await s.RequestAsync(await s.EventAsync(), room.Id);
        var pending = new[] { await s.ActAsync(first.Id, "confirm"), await s.ActAsync(second.Id, "confirm") };
        await Task.WhenAll(pending.Select(async value =>
        {
            try
            { await s.Processor.ProcessOneAsync(s.Parish, value.CurrentWorkId!, "fixture-worker", default); }
            catch (DomainException error) when (error.Kind == FailureKind.Conflict) { }
        }));
        foreach (var value in pending)
            await s.Processor.ProcessOneAsync(s.Parish, value.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        var result = new[] { (await s.Reservations.GetAsync(s.Parish, first.Id, default)).Value, (await s.Reservations.GetAsync(s.Parish, second.Id, default)).Value };
        Assert.Single(result, row => row.Status == "Confirmed");
        Assert.Single(result, row => row.Status == "Conflict");
        Assert.Equal("resource_conflict", result.Single(row => row.Status == "Conflict").ErrorCode);
    }

    [Fact]
    public async Task Setup_cleanup_and_pairwise_exclusions_block_real_conflicts_without_overblocking_independent_rooms()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var whole = await s.FacilityAsync();
        var firstRoom = await s.FacilityAsync(cleanup: 30, exclusions: [whole.Id]);
        var secondRoom = await s.FacilityAsync(exclusions: [whole.Id]);
        var firstEvent = await s.EventAsync();
        var first = await s.ActAsync((await s.RequestAsync(firstEvent, firstRoom.Id)).Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, first.CurrentWorkId!, "fixture-worker", default);
        var sibling = await s.ActAsync((await s.RequestAsync(await s.EventAsync(), secondRoom.Id)).Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, sibling.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Confirmed", (await s.Reservations.GetAsync(s.Parish, sibling.Id, default)).Value.Status);
        var late = await s.ActAsync((await s.RequestAsync(await s.EventAsync(start: firstEvent.EndsAt.AddMinutes(15)), firstRoom.Id)).Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, late.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Conflict", (await s.Reservations.GetAsync(s.Parish, late.Id, default)).Value.Status);
        var combined = await s.ActAsync((await s.RequestAsync(await s.EventAsync(), whole.Id)).Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, combined.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Conflict", (await s.Reservations.GetAsync(s.Parish, combined.Id, default)).Value.Status);
        Assert.NotEmpty(await s.Facilities.AvailabilityAsync(s.Parish, whole.Id, firstEvent.StartsAt, firstEvent.EndsAt, default));
    }

    [Fact]
    public async Task Cancellation_before_processing_fences_delayed_holds_and_allows_a_new_attempt()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var room = await s.FacilityAsync();
        var occurrence = await s.EventAsync();
        var pending = await s.ActAsync((await s.RequestAsync(occurrence, room.Id)).Id, "confirm");
        Assert.Equal("Cancelling", (await s.ActAsync(pending.Id, "cancel")).Status);
        await s.Processor.ProcessOneAsync(s.Parish, pending.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Cancelled", (await s.Reservations.GetAsync(s.Parish, pending.Id, default)).Value.Status);
        var allocator = fixture.Services.GetRequiredService<IResourceAllocator>();
        var error = await Assert.ThrowsAsync<DomainException>(() => allocator.HoldAsync(new AllocationRequest
        {
            ResourceId = FacilityService.FacilityKey(s.Parish, room.Id),
            ParishId = s.Parish,
            BookingId = pending.Id,
            StartsAt = occurrence.StartsAt,
            EndsAt = occurrence.EndsAt,
            Quantity = 1,
            Capacity = 1
        }, pending.CurrentWorkId!, fixture.Clock.Now.AddMinutes(5), default));
        Assert.Equal("allocation_cancelled", error.Code);
        var replacement = await s.ActAsync((await s.RequestAsync(occurrence, room.Id)).Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, replacement.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Confirmed", (await s.Reservations.GetAsync(s.Parish, replacement.Id, default)).Value.Status);
    }

    [Theory]
    [InlineData("role_revoked")]
    [InlineData("security_reset")]
    [InlineData("mfa_removed")]
    public async Task Worker_rechecks_selected_authority_and_never_borrows_a_legacy_grant(string change)
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var room = await s.FacilityAsync();
        var pending = await s.ActAsync((await s.RequestAsync(await s.EventAsync(), room.Id)).Id, "confirm");
        fixture.As(fixture.FirstAdmin);
        await fixture.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(fixture.Other),
            Allows = [Permissions.FacilitiesManage],
            StartsAt = fixture.Clock.Now
        }, default);
        if (change == "role_revoked")
            await s.Staff.ActAsync(new() { Id = s.Appointment, ParishId = s.Parish }, StaffAppointmentAction.Revoke);
        else
        {
            var users = fixture.Services.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ParishLife.Api.Identity.ParishUser>>();
            var user = (await users.FindByIdAsync(fixture.Other))!;
            if (change == "security_reset")
                Assert.True((await users.UpdateSecurityStampAsync(user)).Succeeded);
            else
            { user.TwoFactorEnabled = false; Assert.True((await users.UpdateAsync(user)).Succeeded); }
        }
        fixture.Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await s.Processor.ProcessOneAsync(s.Parish, pending.CurrentWorkId!, "fixture-worker", default);
        fixture.As(fixture.FirstAdmin);
        var result = (await s.Reservations.GetAsync(s.Parish, pending.Id, default)).Value;
        Assert.Equal("Conflict", result.Status);
        Assert.Equal("authorization_changed", result.ErrorCode);
        Assert.Empty(await fixture.Services.GetRequiredService<IResourceAllocator>().BusyAsync(FacilityService.FacilityKey(s.Parish, room.Id), pending.StartsAt, pending.EndsAt, default));
    }

    [Fact]
    public async Task Stale_confirmation_rolls_back_its_work_and_scope_and_source_forgery_is_rejected()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var room = await s.FacilityAsync();
        var occurrence = await s.EventAsync();
        var booking = await s.RequestAsync(occurrence, room.Id);
        s.Use();
        var before = (await s.Staff.Parishes.GetAsync(s.Parish, default))!;
        var operation = Guid.NewGuid();
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => s.Reservations.ActAsync(s.Parish, booking.Id,
            new ReservationActionDto { OperationId = operation, Version = "stale", Action = "confirm", Reason = "Isolated stale decision" }, default))).Code);
        Assert.Equal(before.Version, (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version);
        Assert.Null(await fixture.Services.GetRequiredService<IRecordTransactions>().ReadAsync<ReservationWork>(SchedulingScope.For(s.Parish), "reservationWork:" + operation.ToString("N"), default));
        Assert.Equal("source_command_required", (await Assert.ThrowsAsync<DomainException>(() => s.Calendar.SaveAsync(s.Parish, null,
            new SaveEventDto
            {
                OperationId = Guid.NewGuid(),
                Title = "Forged source",
                Kind = "ParishActivity",
                StartsAt = occurrence.StartsAt,
                EndsAt = occurrence.EndsAt,
                Visibility = "Public",
                TimeZone = "UTC",
                SourceType = "sacrament",
                SourceId = Guid.NewGuid()
            }, default))).Code);
        await Assert.ThrowsAsync<DomainException>(() => s.Calendar.GetAsync(Guid.NewGuid().ToString("N"), occurrence.Id, default));
        var legacyId = Guid.NewGuid();
        var legacy = new CalendarEvent { Id = legacyId.ToString("N"), ParishId = s.Parish, Title = "Unreviewed legacy subject", Kind = "ParishActivity",
            StartsAt = occurrence.StartsAt, EndsAt = occurrence.EndsAt, TimeZone = "UTC", Visibility = "Public", Status = "Confirmed", Published = true,
            CreatedBy = fixture.Other, SourceType = "unreviewed-source" };
        await fixture.Services.GetRequiredService<IRecordTransactions>().CommitAsync(SchedulingScope.For(s.Parish),
            Operation.Create(legacyId, fixture.Other, new { Fixture = "legacy source import" }, fixture.Clock), "fixture.import", legacy.Id,
            [RecordChange.Create("event:" + legacy.Id, "event", legacy)], legacy, default);
        Assert.Empty((await s.Calendar.PublicAsync(s.Parish, occurrence.StartsAt.AddHours(-1), occurrence.EndsAt.AddHours(1), 25, null, default)).Items);
    }
}
