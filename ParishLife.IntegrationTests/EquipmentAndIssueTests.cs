// Purpose: verifies equipment bookings and facility issue handling (S23.13–S23.14) through real local services and storage.
// Main tests: bookings never overcommit stock and quantity cannot drop below held units; missing/damaged returns open evidenced issues;
// issues move through triage and repair, and urgent issues or hazards are never cleared by their own reporter.

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

public class EquipmentAndIssueTests
{
    private sealed record Setup(LocalBackendFixture F, SchedulingScenario S, string Reporter)
    {
        public EquipmentService Equipment => F.Services.GetRequiredService<EquipmentService>();
        public FacilityIssueService Issues => F.Services.GetRequiredService<FacilityIssueService>();
        public string Parish => S.Parish;
    }

    [Fact]
    public async Task Bookings_never_overcommit_and_missing_or_damaged_returns_open_issues()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var start = f.Clock.Now.AddDays(1);
        var morning = await x.S.EventAsync(start);
        var overlap = await x.S.EventAsync(start.AddMinutes(30));
        var evening = await x.S.EventAsync(start.AddHours(6));
        x.S.Use();
        var chairs = await x.Equipment.SaveAsync(x.Parish, null, new SaveEquipmentDto { OperationId = Guid.NewGuid(), Name = "Folding chairs", Quantity = 10, Storage = "Hall store" }, default);
        var first = await BookAsync(x, chairs.Id, morning.Id, 6);
        Assert.Equal("invalid_equipment_state", (await Assert.ThrowsAsync<DomainException>(() => BookAsync(x, chairs.Id, overlap.Id, 5))).Code);
        await BookAsync(x, chairs.Id, overlap.Id, 4);
        await BookAsync(x, chairs.Id, evening.Id, 10);
        Assert.Equal("invalid_equipment_state", (await Assert.ThrowsAsync<DomainException>(() => SaveAsync(x, chairs.Id, 9))).Code);
        Assert.Equal(10, (await SaveAsync(x, chairs.Id, 10)).Quantity);

        await ActAsync(x, first.Id, "issue", r => r.IssuedTo = "Isolated youth team");
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, first.Id, "return", r => { r.ReturnedQuantity = 5; r.Condition = "Damaged"; }))).Code);
        var returned = await ActAsync(x, first.Id, "return", r => { r.ReturnedQuantity = 5; r.Condition = "Damaged"; r.Evidence = "Isolated photo of a broken chair"; });
        Assert.Equal(("Returned", 5), (returned.Status, returned.ReturnedQuantity));
        Assert.Equal(9, (await x.Equipment.ListAsync(x.Parish, 25, null, default)).Items.Single().Value.Quantity);
        var opened = Assert.Single((await x.Issues.ListAsync(x.Parish, "Reported", 25, null, default)).Items).Value;
        Assert.Equal(("Equipment", chairs.Id), (opened.ResourceKind, opened.ResourceId));
        Assert.Contains("1 unit(s) missing", opened.Description);
    }

    [Fact]
    public async Task Issues_need_triage_and_evidence_and_hazards_are_never_cleared_by_their_reporter()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var hall = await x.S.FacilityAsync();
        f.As(x.Reporter);
        var hazard = await x.Issues.ReportAsync(x.Parish, Report(hall.Id, "Hazard"), default);
        Assert.Equal("Reported", hazard.Status);
        await Assert.ThrowsAsync<DomainException>(() => IssueActAsync(x, hazard.Id, "triage"));

        x.S.Use();
        await IssueActAsync(x, hazard.Id, "triage", r => { r.AssignedTo = Guid.Parse(x.Reporter); r.Note = "Electrician booked"; });
        await IssueActAsync(x, hazard.Id, "start-repair");
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => IssueActAsync(x, hazard.Id, "resolve"))).Code);
        var resolved = await IssueActAsync(x, hazard.Id, "resolve", r => { r.Evidence = "Isolated electrician certificate"; r.CostNote = "Quote 120 USD"; });
        Assert.Equal(("Resolved", f.Other), (resolved.Status, resolved.ResolvedBy));

        var own = await x.Issues.ReportAsync(x.Parish, Report(hall.Id, "Urgent"), default);
        await IssueActAsync(x, own.Id, "triage");
        Assert.Equal("invalid_issue_state", (await Assert.ThrowsAsync<DomainException>(() => IssueActAsync(x, own.Id, "resolve", r => r.Evidence = "Self-cleared"))).Code);
        var minor = await x.Issues.ReportAsync(x.Parish, Report(hall.Id, "Low"), default);
        Assert.Equal("Dismissed", (await IssueActAsync(x, minor.Id, "dismiss", r => r.Note = "Duplicate of an earlier report")).Status);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "facilities"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows:
            [Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.SchedulePublish, Permissions.FacilitiesManage]));
        var reporter = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(reporter), Allows = [Permissions.ScheduleRead], StartsAt = f.Clock.Now
        }, default);
        return new Setup(f, new SchedulingScenario(staff, appointment.Id), reporter);
    }

    private static Task<EquipmentBookingDto> BookAsync(Setup x, string equipment, string occurrence, int quantity)
        => x.Equipment.BookAsync(x.Parish, equipment, new BookEquipmentDto { OperationId = Guid.NewGuid(), EventId = Guid.Parse(occurrence), Quantity = quantity }, default);

    private static async Task<EquipmentDto> SaveAsync(Setup x, string equipment, int quantity)
        => await x.Equipment.SaveAsync(x.Parish, equipment, new SaveEquipmentDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<FacilityEquipment>(x, "equipment:" + equipment), Name = "Folding chairs", Quantity = quantity
        }, default);

    private static async Task<EquipmentBookingDto> ActAsync(Setup x, string booking, string action, Action<EquipmentBookingActionDto> configure)
    {
        var request = new EquipmentBookingActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync<EquipmentBooking>(x, "equipmentBooking:" + booking), Action = action };
        configure(request);
        return await x.Equipment.ActAsync(x.Parish, booking, request, default);
    }

    private static async Task<FacilityIssueDto> IssueActAsync(Setup x, string issue, string action, Action<IssueActionDto>? configure = null)
    {
        var request = new IssueActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync<FacilityIssue>(x, "facilityIssue:" + issue), Action = action };
        configure?.Invoke(request);
        return await x.Issues.ActAsync(x.Parish, issue, request, default);
    }

    private static ReportIssueDto Report(string facility, string urgency) => new()
    {
        OperationId = Guid.NewGuid(), ResourceId = Guid.Parse(facility), ResourceKind = "Facility", Description = "Isolated exposed wiring near the stage",
        Urgency = urgency, Evidence = "Isolated photo"
    };

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync<T>(Setup x, string key)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<T>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, key, default))!.Version;
}
