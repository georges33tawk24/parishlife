// Purpose: verifies restricted incident records (E07) through real local services and storage.
// Main tests: recorders get a receipt but no read access; handlers run the lifecycle with attributed amendments, notes and communication
// records while the original report stays; links are checked; invalid transitions and stale versions are refused.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Care;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Care;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class IncidentTests
{
    [Fact]
    public async Task Incidents_are_restricted_attributed_and_keep_the_original_report()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var handler = await staff.AcceptAsync(await staff.InviteAsync(f.Other,
            allows: [Permissions.PeopleRead, Permissions.PeopleWrite, Permissions.IncidentsRecord, Permissions.IncidentsManage]));
        var recorderAccount = await f.CreateVerifiedStaffAsync();
        var recorder = await staff.AcceptAsync(await staff.InviteAsync(recorderAccount, allows: [Permissions.IncidentsRecord]));
        var service = f.Services.GetRequiredService<IncidentService>();

        f.AsAppointment(f.Other, handler.Id);
        var child = (await f.Services.GetRequiredService<PeopleService>().CreateAsync(staff.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Child", FamilyName = "Isolated", BirthDate = new DateOnly(2015, 3, 1)
        }, default)).Id;

        f.AsAppointment(recorderAccount, recorder.Id);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => service.RecordAsync(staff.Parish, Report(child, f.Clock.Now.AddHours(1)), default))).Code);
        await Assert.ThrowsAsync<DomainException>(() => service.RecordAsync(staff.Parish, Report(Guid.NewGuid().ToString(), f.Clock.Now.AddHours(-1)), default));
        var receipt = await service.RecordAsync(staff.Parish, Report(child, f.Clock.Now.AddHours(-1)), default);
        Assert.Equal(("Recorded", true), (receipt.Status, receipt.Urgent));
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(staff.Parish, receipt.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(staff.Parish, null, null, default));

        f.AsAppointment(f.Other, handler.Id);
        Assert.Equal("invalid_incident_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(f, service, staff.Parish, receipt.Id, "resolve", text: "Too early"))).Code);
        await ActAsync(f, service, staff.Parish, receipt.Id, "assign", handlerAccount: f.Other);
        await ActAsync(f, service, staff.Parish, receipt.Id, "amend", field: "Description", text: "Child slipped near the side door, not the stairs.");
        await ActAsync(f, service, staff.Parish, receipt.Id, "note", text: "Reviewer-only: check the door mat.");
        Assert.Equal("invalid_incident_state", (await Assert.ThrowsAsync<DomainException>(() =>
            ActAsync(f, service, staff.Parish, receipt.Id, "communication", person: Guid.NewGuid().ToString(), text: "Told the guardian."))).Code);
        await ActAsync(f, service, staff.Parish, receipt.Id, "communication", person: child, text: "Guardian informed by phone of the reviewed facts.");
        await ActAsync(f, service, staff.Parish, receipt.Id, "follow-up", text: "Replace the door mat by Friday.");
        await ActAsync(f, service, staff.Parish, receipt.Id, "resolve", text: "Mat replaced.");
        var closed = await ActAsync(f, service, staff.Parish, receipt.Id, "close", text: "No remaining restrictions.");
        Assert.Equal("Closed", closed.Status);
        Assert.Equal("Child fell on the stairs.", closed.Description);
        Assert.Equal(["Step", "Amendment", "ReviewerNote", "Communication", "Step", "Step", "Step"], closed.Entries.Select(e => e.Kind).ToArray());
        Assert.All(closed.Entries, e => Assert.Equal(f.Other, e.By));
        Assert.Equal("invalid_incident_state", (await Assert.ThrowsAsync<DomainException>(() =>
            ActAsync(f, service, staff.Parish, receipt.Id, "amend", field: "Description", text: "Too late"))).Code);
        Assert.Equal("FollowUp", (await ActAsync(f, service, staff.Parish, receipt.Id, "reopen", text: "Guardian reported a later injury.")).Status);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.ActAsync(staff.Parish, receipt.Id, new IncidentActionDto
        {
            OperationId = Guid.NewGuid(), Version = "\"stale\"", Action = "note", Text = "Stale"
        }, default))).Code);
        Assert.Single(await service.ListAsync(staff.Parish, "FollowUp", null, default));
        Assert.Contains((await f.Services.GetRequiredService<NotificationService>().ListAsync(null, 25, null, default)).Items, n => n.Topic == "incident.assigned");
    }

    private static RecordIncidentDto Report(string person, DateTimeOffset at) => new()
    {
        OperationId = Guid.NewGuid(), OccurredAt = at, PersonIds = [Guid.Parse(person)], Location = "Parish hall", Description = "Child fell on the stairs.",
        ImmediateActions = "First aid given; guardian called.", Urgent = true
    };

    private static async Task<IncidentDto> ActAsync(LocalBackendFixture f, IncidentService service, string parish, string id, string action,
        string? handlerAccount = null, string? field = null, string? person = null, string? text = null)
        => await service.ActAsync(parish, id, new IncidentActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await service.GetAsync(parish, id, default)).Version, Action = action,
            HandlerAccountId = handlerAccount is null ? null : Guid.Parse(handlerAccount), Field = field, PersonId = person is null ? null : Guid.Parse(person), Text = text
        }, default);
}
