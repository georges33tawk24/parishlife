// Purpose: keeps restricted incident records: recorders store a protected factual report, and only incident handlers read it and move it through
// Recorded -> Assigned -> FollowUp -> Resolved -> Closed (with reopen), with attributed amendments, reviewer-only notes and communication records.
// Main functions: RecordAsync, ActAsync, GetAsync and ListAsync. Event participation, ordinary leadership and office access grant nothing here.

using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Care;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Services.Care;

public class IncidentService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, MfaAccountAccess proof,
    IDataProtectionProvider protection, NotificationService notifications, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException Missing() => new("resource_not_found", "The requested incident is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_incident_state", message, FailureKind.Conflict);
    private IDataProtector Protector(string parish, string id) => protection.CreateProtector("ParishLife.Incidents.v1", parish, id);

    private async Task<Versioned<Parish>> RequireAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    public async Task<IncidentReceiptDto> RecordAsync(string parish, RecordIncidentDto request, CancellationToken ct)
    {
        var root = await RequireAsync(parish, Permissions.IncidentsRecord, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "incident:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Receipt((await ReadAsync(parish, prior.Id, ct)).Value);
        if (request.OccurredAt == default || request.OccurredAt > op.At)
            throw new DomainException("invalid_input", "Give when the incident happened; it cannot be in the future.");
        // Links are recorded only when the record exists; nothing is inferred from attendance.
        string? eventId = null;
        if (request.EventId is { } e)
            eventId = (await records.ReadAsync<CalendarEvent>(Scope(parish), "event:" + Guard.Id(e), ct))?.Value.Id ?? throw Missing();
        var persons = request.PersonIds.Select(Guard.Id).Distinct(StringComparer.Ordinal).ToArray();
        foreach (var person in persons)
            if ((await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct))?.Value is not { Archived: false } p || p.ParishId != parish)
                throw Missing();
        var item = new Incident
        {
            Id = op.Id, ParishId = parish, EventId = eventId, PersonIds = persons, OccurredAt = request.OccurredAt, RecordedAt = op.At, RecordedBy = actor.AccountId,
            Urgent = request.Urgent, Location = string.IsNullOrWhiteSpace(request.Location) ? null : Guard.Text(request.Location, "Location", 300)
        };
        item.ProtectedReport = Protector(parish, item.Id).Protect(JsonSerializer.Serialize(new IncidentReport
        {
            Description = Guard.Text(request.Description, "Description", 8000), ImmediateActions = Optional(request.ImmediateActions, "Immediate actions", 4000),
            Witnesses = Optional(request.Witnesses, "Witnesses", 2000)
        }));
        await records.CommitAsync(Scope(parish), op, "incident.record", item.Id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Create("incident:" + item.Id, "incident", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Receipt(item);
    }

    public async Task<IncidentDto> ActAsync(string parish, string id, IncidentActionDto request, CancellationToken ct)
    {
        var root = await RequireAsync(parish, Permissions.IncidentsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "incident-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Entries.Count >= 200)
            throw State("This incident has reached its entry limit; record a linked follow-up incident.");
        var text = request.Action == "assign" ? null : Guard.Text(request.Text, "Text", 4000);
        var entry = new IncidentEntry { Kind = "Step", Action = request.Action, By = actor.AccountId, At = op.At };
        switch (request.Action)
        {
            case "assign" when item.Status is "Recorded" or "Assigned" or "FollowUp":
                item.HandlerAccountId = Guard.Id(request.HandlerAccountId ?? throw new DomainException("invalid_input", "Choose the responsible handler."));
                if (item.Status == "Recorded") item.Status = "Assigned";
                text = "Handler " + item.HandlerAccountId;
                break;
            case "follow-up" when item.Status is "Assigned" or "FollowUp":
                item.Status = "FollowUp";
                break;
            case "resolve" when item.Status is "Assigned" or "FollowUp":
                item.Status = "Resolved";
                break;
            case "close" when item.Status == "Resolved":
                item.Status = "Closed";
                break;
            case "reopen" when item.Status is "Resolved" or "Closed":
                item.Status = "FollowUp";
                break;
            // The original report is kept; an amendment records the attributed corrected text next to it.
            case "amend" when item.Status != "Closed":
                entry.Kind = "Amendment";
                entry.Field = request.Field ?? throw new DomainException("invalid_input", "Choose the report field being amended.");
                break;
            case "note":
                entry.Kind = "ReviewerNote";
                break;
            // Records what was told to a guardian or subject outside the system; nothing is sent from here.
            case "communication":
                entry.Kind = "Communication";
                entry.PersonId = Guard.Id(request.PersonId ?? throw new DomainException("invalid_input", "Choose who was informed."));
                if (!item.PersonIds.Contains(entry.PersonId, StringComparer.Ordinal))
                    throw State("Record communications only for people linked to this incident.");
                break;
            default:
                throw State("That action is not available while the incident is " + item.Status + ".");
        }
        entry.ProtectedText = Protector(parish, id).Protect(text!);
        item.Entries.Add(entry);
        await records.CommitAsync(Scope(parish), op, "incident." + request.Action.Replace('-', '_'), id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Replace("incident:" + id, "incident", item, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = item.Status }, ct);
        if (request.Action == "assign")
            await notifications.NotifyAsync(item.HandlerAccountId!, parish, "incident.assigned", "An incident record has been assigned to you.",
                "/api/parishes/" + parish + "/incidents/" + id, required: true, "incident:" + op.Id, ct);
        return Project(item);
    }

    public async Task<Versioned<IncidentDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await RequireAsync(parish, Permissions.IncidentsManage, ct);
        var row = await ReadAsync(parish, id, ct);
        return new Versioned<IncidentDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<IReadOnlyList<Versioned<IncidentDto>>> ListAsync(string parish, string? status, string? eventId, CancellationToken ct)
    {
        await RequireAsync(parish, Permissions.IncidentsManage, ct);
        var conditions = new List<RecordCondition>();
        if (status is not null) conditions.Add(new RecordCondition { Path = "status", Comparison = "eq", Value = Guard.Text(status, "Status", 20) });
        if (eventId is not null) conditions.Add(new RecordCondition { Path = "eventId", Comparison = "eq", Value = eventId });
        return (await records.CollectAsync<Incident>(Scope(parish), "incident", ct, 2000, [.. conditions]))
            .OrderByDescending(r => r.Value.RecordedAt).Select(r => new Versioned<IncidentDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    private async Task<Versioned<Incident>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<Incident>(Scope(parish), "incident:" + id, ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    private static string? Optional(string? value, string name, int max) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, name, max);

    private static IncidentReceiptDto Receipt(Incident x) => new() { Id = x.Id, Status = "Recorded", RecordedAt = x.RecordedAt, Urgent = x.Urgent };

    private IncidentDto Project(Incident x)
    {
        var protector = Protector(x.ParishId, x.Id);
        var report = JsonSerializer.Deserialize<IncidentReport>(protector.Unprotect(x.ProtectedReport)) ?? new IncidentReport();
        return new IncidentDto
        {
            Id = x.Id, EventId = x.EventId, Location = x.Location, PersonIds = x.PersonIds, OccurredAt = x.OccurredAt, RecordedAt = x.RecordedAt, RecordedBy = x.RecordedBy,
            Urgent = x.Urgent, Status = x.Status, HandlerAccountId = x.HandlerAccountId, Description = report.Description, ImmediateActions = report.ImmediateActions,
            Witnesses = report.Witnesses,
            Entries = x.Entries.Select(e => new IncidentEntryDto
            {
                Kind = e.Kind, Action = e.Action, Field = e.Field, PersonId = e.PersonId, By = e.By, At = e.At,
                Text = e.ProtectedText is null ? null : protector.Unprotect(e.ProtectedText)
            }).ToArray()
        };
    }
}
