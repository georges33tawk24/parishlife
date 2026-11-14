// Purpose: verifies the facilities completion work through real local services, storage and HTTP: Arabic name twins, the equipment
// condition grade, reservation details/checklist/decision history with redaction, and dated maintenance blocks that conflict with
// reservations through the shared resource guards.
// Main tests: Arabic_twins_round_trip_and_older_records_return_null, Maintenance_blocks_and_reservations_exclude_each_other,
// Maintenance_blocks_protect_exclusion_pairs_and_check_access_state_and_replay, Reservation_details_checklist_and_history_are_kept_and_redacted,
// Maintenance_and_details_routes_work_over_authenticated_http.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class FacilitiesCompletionTests
{
    [Fact]
    public async Task Arabic_twins_round_trip_and_older_records_return_null()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(f);
        s.Use();
        var hall = await s.Facilities.SaveAsync(s.Parish, null, new SaveFacilityDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated hall", NameAr = "  قاعة معزولة  ", Kind = "Space", Capacity = 50,
            PublicDescription = "Isolated description", PublicDescriptionAr = "وصف معزول"
        }, default);
        Assert.Equal(("قاعة معزولة", "وصف معزول"), (hall.NameAr, hall.PublicDescriptionAr));
        var plain = await s.FacilityAsync();
        s.Use();
        var read = await s.Facilities.GetAsync(s.Parish, plain.Id, default);
        Assert.Null(read.Value.NameAr);
        Assert.Null(read.Value.PublicDescriptionAr);

        var equipment = f.Services.GetRequiredService<EquipmentService>();
        var mics = await equipment.SaveAsync(s.Parish, null, new SaveEquipmentDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated microphones", NameAr = "ميكروفونات", Quantity = 4, ConditionGrade = "Fair"
        }, default);
        Assert.Equal(("ميكروفونات", "Fair"), (mics.NameAr, mics.ConditionGrade));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => equipment.SaveAsync(s.Parish, null, new SaveEquipmentDto
        { OperationId = Guid.NewGuid(), Name = "Isolated item", Quantity = 1, ConditionGrade = "Excellent" }, default))).Code);
        var listed = Assert.Single((await equipment.ListAsync(s.Parish, 25, null, default)).Items).Value;
        Assert.Equal("Fair", listed.ConditionGrade);

        var issues = f.Services.GetRequiredService<FacilityIssueService>();
        var issue = await issues.ReportAsync(s.Parish, new ReportIssueDto
        {
            OperationId = Guid.NewGuid(), ResourceId = Guid.Parse(hall.Id), ResourceKind = "Facility", Description = "Isolated light out",
            DescriptionAr = "مصباح معطل", Urgency = "Low"
        }, default);
        Assert.Equal("مصباح معطل", (await issues.GetAsync(s.Parish, issue.Id, default)).Value.DescriptionAr);

        var rentals = f.Services.GetRequiredService<RentalService>();
        var renter = await rentals.CreateRenterAsync(s.Parish, new SaveRenterDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated society", NameAr = "جمعية معزولة", Organization = "Isolated org", OrganizationAr = "منظمة",
            ResponsibleContact = "renter@fixture.example"
        }, default);
        Assert.Equal(("جمعية معزولة", "منظمة"), (renter.NameAr, renter.OrganizationAr));
        Assert.Equal("منظمة", Assert.Single(await rentals.RentersAsync(s.Parish, default)).OrganizationAr);
    }

    [Fact]
    public async Task Maintenance_blocks_and_reservations_exclude_each_other()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(f);
        var maintenance = f.Services.GetRequiredService<MaintenanceService>();
        var roomA = await s.FacilityAsync();
        var roomC = await s.FacilityAsync(exclusions: [roomA.Id]);
        var start = f.Clock.Now.AddDays(1);
        s.Use();
        var block = await maintenance.ScheduleAsync(s.Parish, Block(roomA.Id, start, start.AddHours(3)), default);
        Assert.Equal("Active", block.Status);
        Assert.Equal(("Isolated repainting", "إعادة طلاء", "Isolated team"), (block.Reason, block.ReasonAr, block.InCharge));
        var busy = Assert.Single(await s.Facilities.AvailabilityAsync(s.Parish, roomA.Id, start.AddHours(-1), start.AddHours(4), default));
        Assert.Equal((start, start.AddHours(3)), (busy.StartsAt, busy.EndsAt));

        // A reservation for the blocked room, or for a room that excludes it, ends in Conflict through the allocator.
        var occurrence = await s.EventAsync(start.AddMinutes(30));
        var onA = await s.RequestAsync(occurrence, roomA.Id);
        var queued = await s.ActAsync(onA.Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, queued.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        var conflicted = (await s.Reservations.GetAsync(s.Parish, onA.Id, default)).Value;
        Assert.Equal(("Conflict", "resource_conflict"), (conflicted.Status, conflicted.ErrorCode));
        Assert.Equal(new[] { "request", "confirm", "conflict" }, conflicted.Decisions.Select(d => d.Action).ToArray());
        Assert.Equal("system", conflicted.Decisions[^1].ActorId);
        var onC = await s.RequestAsync(await s.EventAsync(start.AddMinutes(30)), roomC.Id);
        var queuedC = await s.ActAsync(onC.Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, queuedC.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Conflict", (await s.Reservations.GetAsync(s.Parish, onC.Id, default)).Value.Status);

        // Cancelling the block releases its guards and the same reservation can now be allocated.
        var cancelled = await CancelAsync(f, s, maintenance, block.Id);
        s.Use();
        Assert.Equal(("Cancelled", f.Other, "Isolated work postponed"), (cancelled.Status, cancelled.CancelledBy, cancelled.CancelReason));
        Assert.Empty(await s.Facilities.AvailabilityAsync(s.Parish, roomA.Id, start.AddHours(-1), start.AddHours(4), default));
        var again = await s.ActAsync(onA.Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, again.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Confirmed", (await s.Reservations.GetAsync(s.Parish, onA.Id, default)).Value.Status);

        // A block cannot take a period a confirmed reservation holds; the attempt stays visible as Conflict.
        var refused = await Assert.ThrowsAsync<DomainException>(() => maintenance.ScheduleAsync(s.Parish, Block(roomA.Id, start, start.AddHours(1)), default));
        Assert.Equal("maintenance_conflict", refused.Code);
        var list = (await maintenance.ListAsync(s.Parish, start.AddDays(-1), start.AddDays(1), 25, null, default)).Items.Select(i => i.Value).ToArray();
        Assert.Contains(list, b => b.Status == "Conflict" && b.ErrorCode == "resource_conflict");
        Assert.Contains(list, b => b.Id == block.Id && b.Status == "Cancelled");
        // A later, free period is fine.
        Assert.Equal("Active", (await maintenance.ScheduleAsync(s.Parish, Block(roomA.Id, start.AddHours(5), start.AddHours(6)), default)).Status);
    }

    [Fact]
    public async Task Maintenance_blocks_protect_exclusion_pairs_and_check_access_state_and_replay()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(f);
        var maintenance = f.Services.GetRequiredService<MaintenanceService>();
        var roomD = await s.FacilityAsync();
        var roomE = await s.FacilityAsync(exclusions: [roomD.Id]);
        var start = f.Clock.Now.AddDays(2);
        s.Use();
        var request = Block(roomD.Id, start, start.AddHours(2));
        var block = await maintenance.ScheduleAsync(s.Parish, request, default);
        Assert.Equal(block.Id, (await maintenance.ScheduleAsync(s.Parish, request, default)).Id);

        // The exclusion pair a block holds cannot change under it; cancelling the block allows the change.
        var edit = await ExclusionEditAsync(f, s, roomE.Id);
        Assert.Equal("facility_dependencies_active", (await Assert.ThrowsAsync<DomainException>(() => s.Facilities.SaveAsync(s.Parish, roomE.Id, edit, default))).Code);
        await CancelAsync(f, s, maintenance, block.Id);
        Assert.Equal("invalid_maintenance_state", (await Assert.ThrowsAsync<DomainException>(() => CancelAsync(f, s, maintenance, block.Id))).Code);
        s.Use();
        Assert.Empty((await s.Facilities.SaveAsync(s.Parish, roomE.Id, await ExclusionEditAsync(f, s, roomE.Id), default)).ExclusionResourceIds);

        // A period that has ended is refused, and a missing room is not found.
        Assert.Equal("invalid_period", (await Assert.ThrowsAsync<DomainException>(() => maintenance.ScheduleAsync(s.Parish, Block(roomD.Id, f.Clock.Now.AddHours(-2), f.Clock.Now.AddHours(-1)), default))).Code);
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => maintenance.ScheduleAsync(s.Parish, Block(Guid.NewGuid().ToString("N"), start, start.AddHours(1)), default))).Code);

        // Schedule readers see blocks but cannot schedule or cancel them.
        var reader = await GrantReaderAsync(f, s);
        s.Use();
        var current = await maintenance.ScheduleAsync(s.Parish, Block(roomD.Id, start.AddHours(3), start.AddHours(4)), default);
        f.As(reader);
        Assert.Equal(2, (await maintenance.ListAsync(s.Parish, start.AddDays(-1), start.AddDays(1), 25, null, default)).Items.Count);
        Assert.Equal("Active", (await maintenance.GetAsync(s.Parish, current.Id, default)).Value.Status);
        await Assert.ThrowsAsync<DomainException>(() => maintenance.ScheduleAsync(s.Parish, Block(roomD.Id, start.AddHours(5), start.AddHours(6)), default));
        await Assert.ThrowsAsync<DomainException>(() => CancelAsync(f, s, maintenance, current.Id, reader));
    }

    [Fact]
    public async Task Reservation_details_checklist_and_history_are_kept_and_redacted()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(f);
        var room = await s.FacilityAsync();
        var occurrence = await s.EventAsync(title: "Isolated rehearsal");
        s.Use();
        var booking = await s.Reservations.RequestAsync(s.Parish, new ReserveDto
        {
            OperationId = Guid.NewGuid(), EventId = Guid.Parse(occurrence.Id), ResourceId = Guid.Parse(room.Id), StartsAt = occurrence.StartsAt, EndsAt = occurrence.EndsAt,
            Purpose = "Isolated choir practice", PurposeAr = "تمرين الجوقة", ExpectedAttendance = 25, ContactPhone = "+000 0000", Notes = "Isolated note"
        }, default);
        Assert.Equal(("Isolated rehearsal", "تمرين الجوقة", 25), (booking.EventTitle, booking.PurposeAr, booking.ExpectedAttendance));
        Assert.Equal("request", Assert.Single(booking.Decisions).Action);

        var saved = await DetailsAsync(f, s, booking.Id, [new() { Phase = "Opening", Label = "Unlock hall", LabelAr = "فتح القاعة", Done = true }, new() { Phase = "Closing", Label = "Lock up" }]);
        var ticked = saved.Checklist[0];
        Assert.Equal((true, f.Other), (ticked.Done, ticked.DoneBy));
        Assert.Null(saved.Checklist[1].DoneBy);
        Assert.Null(saved.Purpose); // replaced as sent, nothing carried over silently
        f.Clock.Now = f.Clock.Now.AddMinutes(10);
        var resaved = await DetailsAsync(f, s, booking.Id, [new() { Phase = "Opening", Label = "Unlock hall", Done = true }, new() { Phase = "Closing", Label = "Lock up", Done = true }]);
        Assert.Equal(ticked.DoneAt, resaved.Checklist[0].DoneAt);
        Assert.Equal(f.Clock.Now, resaved.Checklist[1].DoneAt);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => DetailsAsync(f, s, booking.Id, [new() { Phase = "During", Label = "Bad" }]))).Code);

        // A schedule reader cannot change details.
        var reader = await GrantReaderAsync(f, s);
        f.As(reader);
        await Assert.ThrowsAsync<DomainException>(() => DetailsAsync(f, s, booking.Id, [], asCurrent: true));

        // Another facility manager sees a private booking as busy only: no details, checklist or history.
        var hidden = await s.RequestAsync(await s.EventAsync(visibility: "Private", title: "Isolated private subject"), room.Id);
        s.Use();
        await DetailsAsync(f, s, hidden.Id, [new() { Phase = "Opening", Label = "Private step", Done = true }]);
        var other = await f.CreateVerifiedStaffAsync();
        var role = await s.Staff.AcceptAsync(await s.Staff.InviteAsync(other, allows: [Permissions.ScheduleRead, Permissions.FacilitiesManage]));
        f.AsAppointment(other, role.Id);
        var redacted = (await s.Reservations.GetAsync(s.Parish, hidden.Id, default)).Value;
        Assert.True(redacted.Redacted);
        Assert.Null(redacted.EventTitle);
        Assert.Empty(redacted.Checklist);
        Assert.Empty(redacted.Decisions);
        await Assert.ThrowsAsync<DomainException>(() => DetailsAsync(f, s, hidden.Id, [], asCurrent: true));

        // A cancelled reservation keeps its history and refuses further details.
        await s.ActAsync(booking.Id, "cancel");
        s.Use();
        var ended = (await s.Reservations.GetAsync(s.Parish, booking.Id, default)).Value;
        Assert.Equal(new[] { "request", "cancel" }, ended.Decisions.Select(d => d.Action).ToArray());
        Assert.Equal("Isolated office decision", ended.Decisions[^1].Reason);
        Assert.Equal("invalid_reservation_state", (await Assert.ThrowsAsync<DomainException>(() => DetailsAsync(f, s, booking.Id, []))).Code);
    }

    [Fact]
    public async Task Maintenance_and_details_routes_work_over_authenticated_http()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var office = factory.Client();
        using var visitor = factory.Client();
        var root = $"/api/parishes/{s.Parish}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(root + "/maintenance-blocks?start=2026-01-01T00:00:00Z&end=2026-01-02T00:00:00Z")).StatusCode);
        await Csrf(office);
        var pending = await Read<JsonElement>(await office.PostAsJsonAsync("/api/auth/login", new { username = "other@fixture.example", password = "isolated-fixture-long-password" }));
        var challenge = pending.GetProperty("challenge");
        await Read<JsonElement>(await office.PostAsJsonAsync("/api/auth/login/mfa", new { accountId = challenge.GetProperty("accountId").GetString(), challenge = challenge.GetProperty("challenge").GetString(), code = TestAuthenticator.Code() }));
        await Csrf(office);
        office.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        var room = await Read<FacilityDto>(await office.PostAsJsonAsync(root + "/facilities", new SaveFacilityDto { OperationId = Guid.NewGuid(), Name = "Isolated HTTP room", NameAr = "غرفة", Kind = "Room", Capacity = 10 }));
        Assert.Equal("غرفة", room.NameAr);
        var start = new DateTimeOffset(DateTimeOffset.UtcNow.AddDays(3).UtcDateTime.Date, TimeSpan.Zero);
        var block = await Read<MaintenanceBlockDto>(await office.PostAsJsonAsync(root + "/maintenance-blocks", new MaintenanceDto
        { OperationId = Guid.NewGuid(), ResourceId = Guid.Parse(room.Id), StartsAt = start, EndsAt = start.AddHours(4), Reason = "Isolated HTTP repair" }));
        Assert.Equal("Active", block.Status);
        var query = $"?start={Uri.EscapeDataString(start.AddDays(-1).ToString("O"))}&end={Uri.EscapeDataString(start.AddDays(1).ToString("O"))}";
        var listed = Assert.Single((await Read<Page<Versioned<MaintenanceBlockDto>>>(await office.GetAsync(root + "/maintenance-blocks" + query))).Items);
        Assert.Equal(HttpStatusCode.Conflict, (await office.PostAsJsonAsync(root + "/maintenance-blocks", new MaintenanceDto
        { OperationId = Guid.NewGuid(), ResourceId = Guid.Parse(room.Id), StartsAt = start.AddHours(1), EndsAt = start.AddHours(2), Reason = "Overlapping" })).StatusCode);
        var cancelled = await Read<MaintenanceBlockDto>(await office.PostAsJsonAsync(root + "/maintenance-blocks/" + block.Id + "/actions",
            new MaintenanceActionDto { OperationId = Guid.NewGuid(), Version = listed.Version, Action = "cancel", Reason = "Isolated HTTP postponement" }));
        Assert.Equal("Cancelled", cancelled.Status);

        var when = DateTimeOffset.UtcNow.AddDays(1);
        var occurrence = await Read<CalendarEventDto>(await office.PostAsJsonAsync(root + "/calendar/events", new SaveEventDto
        { OperationId = Guid.NewGuid(), Title = "Isolated HTTP activity", Kind = "ParishActivity", StartsAt = when, EndsAt = when.AddHours(1), TimeZone = "UTC", Visibility = "Parish" }));
        var booking = await Read<ReservationDto>(await office.PostAsJsonAsync(root + "/reservations", new ReserveDto
        { OperationId = Guid.NewGuid(), ResourceId = Guid.Parse(room.Id), EventId = Guid.Parse(occurrence.Id), StartsAt = occurrence.StartsAt, EndsAt = occurrence.EndsAt, ExpectedAttendance = 8 }));
        var current = await Read<Versioned<ReservationDto>>(await office.GetAsync(root + "/reservations/" + booking.Id));
        var details = await Read<ReservationDto>(await office.PutAsJsonAsync(root + "/reservations/" + booking.Id + "/details", new SaveReservationDetailsDto
        { OperationId = Guid.NewGuid(), Version = current.Version, Purpose = "Isolated HTTP purpose", Checklist = [new() { Phase = "Closing", Label = "Lights off", Done = true }] }));
        Assert.Equal(("Isolated HTTP purpose", "Lights off", "Isolated HTTP activity"), (details.Purpose, details.Checklist.Single().Label, details.EventTitle));
        Assert.Equal(HttpStatusCode.BadRequest, (await office.PutAsJsonAsync(root + "/reservations/" + booking.Id + "/details", new SaveReservationDetailsDto
        { OperationId = Guid.NewGuid(), Version = current.Version, ExpectedAttendance = -1 })).StatusCode);
    }

    private static MaintenanceDto Block(string facility, DateTimeOffset start, DateTimeOffset end) => new()
    {
        OperationId = Guid.NewGuid(), ResourceId = Guid.Parse(facility), StartsAt = start, EndsAt = end,
        Reason = "Isolated repainting", ReasonAr = "إعادة طلاء", InCharge = "Isolated team"
    };

    private static async Task<MaintenanceBlockDto> CancelAsync(LocalBackendFixture f, SchedulingScenario s, MaintenanceService service, string id, string? actor = null)
    {
        var version = (await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<MaintenanceBlock>(SchedulingScope.For(s.Parish), "maintenanceBlock:" + id, default))!.Version;
        if (actor is null)
            s.Use();
        return await service.ActAsync(s.Parish, id, new MaintenanceActionDto { OperationId = Guid.NewGuid(), Version = version, Action = "cancel", Reason = "Isolated work postponed" }, default);
    }

    private static async Task<SaveFacilityDto> ExclusionEditAsync(LocalBackendFixture f, SchedulingScenario s, string id)
    {
        var row = await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<Facility>(SchedulingScope.For(s.Parish), "facility:" + id, default);
        return new SaveFacilityDto { OperationId = Guid.NewGuid(), Version = row!.Version, Name = row.Value.Name, Kind = row.Value.Kind, Capacity = row.Value.Capacity, ExclusionResourceIds = [] };
    }

    private static async Task<ReservationDto> DetailsAsync(LocalBackendFixture f, SchedulingScenario s, string id, SaveChecklistItemDto[] checklist, bool asCurrent = false)
    {
        var version = (await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<Reservation>(SchedulingScope.For(s.Parish), "reservation:" + id, default))!.Version;
        if (!asCurrent)
            s.Use();
        return await s.Reservations.DetailsAsync(s.Parish, id, new SaveReservationDetailsDto { OperationId = Guid.NewGuid(), Version = version, Checklist = checklist }, default);
    }

    private static async Task<string> GrantReaderAsync(LocalBackendFixture f, SchedulingScenario s)
    {
        var reader = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(reader), Allows = [Permissions.ScheduleRead], StartsAt = f.Clock.Now
        }, default);
        s.Use();
        return reader;
    }

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
