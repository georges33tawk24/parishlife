// Purpose: evacuation roll calls for an event, run by assigned door operators: start one from the participants recorded present,
// mark each accounted for (or undo a mark), and close it. Only one roll call per event is open at a time.
// Main functions: StartAsync, ListAsync, GetAsync, ActAsync and ToDtoAsync. Access is the door's: registrations.checkin with current MFA plus the
// event's explicit operator assignment. Entries show names and marks only, never answers, evidence or money. A roll call records what operators
// marked; it is not a census of the building and sends no emergency message.

using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Registrations;

public sealed class EvacuationService(IRecordTransactions records, ICurrentActor actor, RegistrationService registrations)
{
    private const string Coverage = "Participants recorded present for this event when the roll call started, marked by assigned door operators. "
        + "It is not a census of everyone in the building, and it sends no emergency message.";

    private static RecordScope Scope(string parish) => RegistrationService.Scope(parish);
    private static string Key(string id) => "evacuation:" + id;
    private static string OpenKey(string eventId) => "evacuationOpen:" + eventId;

    public async Task<Versioned<EvacuationDto>> StartAsync(string parish, string eventId, StartEvacuationDto request, CancellationToken ct)
    {
        var (root, policy) = await registrations.Door(parish, eventId, ct);
        var op = registrations.Op(request.OperationId, request, "evacuation:" + eventId);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } replay)
            return await ReadAsync(parish, eventId, replay.Id, policy.Value, ct);
        if (request.Kind is not ("Drill" or "Emergency"))
            throw new DomainException("invalid_evacuation_kind", "Use Drill or Emergency.");
        _ = await registrations.Event(parish, eventId, ct);
        if (await records.ReadAsync<CommandResult>(Scope(parish), OpenKey(eventId), ct) is not null)
            throw RegistrationService.Invalid("A roll call is already open for this event; close it first.");
        var present = (await registrations.Participants(parish, eventId, ct)).Select(x => x.Value).Where(x => x.Presence == "Present").OrderBy(x => x.Id, StringComparer.Ordinal);
        var item = new EvacuationRollCall
        {
            Id = op.Id, ParishId = parish, EventId = eventId, Kind = request.Kind, Status = "Open", StartedAt = op.At, StartedBy = actor.AccountId,
            Note = RegistrationTermRules.OptionalText(request.Note, "Note", 2000),
            Entries = present.Select(x => new EvacuationEntry { RegistrationId = x.Id, PersonId = x.PersonId }).ToList()
        };
        await records.CommitAsync(Scope(parish), op, "registration.evacuation_start", item.Id,
            [RegistrationService.Fence(root), RecordChange.Create(Key(item.Id), "evacuation", item), RecordChange.Create(OpenKey(eventId), "evacuationOpen", new CommandResult { Id = item.Id, Status = "Open" }),
             RecordChange.Replace(RegistrationService.PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version)],
            new CommandResult { Id = item.Id, Status = "Open" }, ct);
        return await ReadAsync(parish, eventId, item.Id, policy.Value, ct);
    }

    public async Task<IReadOnlyList<Versioned<EvacuationDto>>> ListAsync(string parish, string eventId, CancellationToken ct)
    {
        var (_, policy) = await registrations.Door(parish, eventId, ct);
        var page = await records.PageAsync<EvacuationRollCall>(Scope(parish), "evacuation", 50, null, ct, new RecordCondition { Path = "eventId", Comparison = "eq", Value = eventId });
        var items = new List<Versioned<EvacuationDto>>();
        foreach (var row in page.Items.OrderByDescending(x => x.Value.StartedAt))
            items.Add(new Versioned<EvacuationDto> { Version = row.Version, Value = await ToDtoAsync(parish, row.Value, policy.Value, ct) });
        return items;
    }

    public async Task<Versioned<EvacuationDto>> GetAsync(string parish, string eventId, string id, CancellationToken ct)
    {
        var (_, policy) = await registrations.Door(parish, eventId, ct);
        return await ReadAsync(parish, eventId, id, policy.Value, ct);
    }

    public async Task<Versioned<EvacuationDto>> ActAsync(string parish, string eventId, string id, EvacuationActionDto request, CancellationToken ct)
    {
        var (root, policy) = await registrations.Door(parish, eventId, ct);
        var op = registrations.Op(request.OperationId, request, "evacuation-action:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await ReadAsync(parish, eventId, id, policy.Value, ct);
        var row = await Row(parish, eventId, id, ct);
        if (row.Value.Status != "Open")
            throw RegistrationService.Invalid("This roll call is closed.");
        var item = new EvacuationRollCall
        {
            Id = row.Value.Id, ParishId = row.Value.ParishId, EventId = row.Value.EventId, Kind = row.Value.Kind, Status = row.Value.Status,
            StartedAt = row.Value.StartedAt, StartedBy = row.Value.StartedBy, Note = row.Value.Note,
            Entries = row.Value.Entries.Select(x => new EvacuationEntry { RegistrationId = x.RegistrationId, PersonId = x.PersonId, AccountedAt = x.AccountedAt, AccountedBy = x.AccountedBy }).ToList()
        };
        var changes = new List<RecordChange> { RegistrationService.Fence(root) };
        if (request.Action is "account" or "unaccount")
        {
            var registrationId = request.RegistrationId is { } r ? Guard.Id(r) : throw new DomainException("registration_required", "Name the participant to mark.");
            var entry = item.Entries.FirstOrDefault(x => x.RegistrationId == registrationId)
                ?? throw new DomainException("registration_resource_unavailable", "That participant is not on this roll call.", FailureKind.NotFound);
            if (request.Action == "account" == entry.AccountedAt is not null)
                throw RegistrationService.Invalid(request.Action == "account" ? "This participant is already marked accounted for." : "This participant is not marked.");
            entry.AccountedAt = request.Action == "account" ? op.At : null;
            entry.AccountedBy = request.Action == "account" ? actor.AccountId : null;
        }
        else if (request.Action == "close")
        {
            var open = await registrations.Get<CommandResult>(parish, OpenKey(eventId), ct);
            item.Status = "Closed";
            item.ClosedAt = op.At;
            item.ClosedBy = actor.AccountId;
            item.Note = RegistrationTermRules.OptionalText(request.Note, "Note", 2000) ?? item.Note;
            changes.Add(RecordChange.Remove(OpenKey(eventId), open.Version));
        }
        else
            throw new DomainException("invalid_evacuation_action", "Use account, unaccount or close.");

        changes.Add(RecordChange.Replace(Key(id), "evacuation", item, Versions.Require(request.Version)));
        await records.CommitAsync(Scope(parish), op, "registration.evacuation_" + request.Action, id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return await ReadAsync(parish, eventId, id, policy.Value, ct);
    }

    private async Task<Versioned<EvacuationRollCall>> Row(string parish, string eventId, string id, CancellationToken ct)
    {
        var row = await registrations.Get<EvacuationRollCall>(parish, Key(id), ct);
        if (row.Value.EventId != eventId)
            throw new DomainException("registration_resource_unavailable", "The requested roll call is unavailable.", FailureKind.NotFound);
        return row;
    }

    private async Task<Versioned<EvacuationDto>> ReadAsync(string parish, string eventId, string id, RegistrationPolicy policy, CancellationToken ct)
    {
        var row = await Row(parish, eventId, id, ct);
        return new Versioned<EvacuationDto> { Version = row.Version, Value = await ToDtoAsync(parish, row.Value, policy, ct) };
    }

    private async Task<EvacuationDto> ToDtoAsync(string parish, EvacuationRollCall x, RegistrationPolicy policy, CancellationToken ct)
    {
        var entries = new List<EvacuationEntryDto>();
        foreach (var e in x.Entries)
        {
            var person = await records.ReadAsync<Person>(Scope(parish), "person:" + e.PersonId, ct);
            entries.Add(new EvacuationEntryDto
            {
                RegistrationId = e.RegistrationId, PersonId = e.PersonId, AccountedAt = e.AccountedAt, AccountedBy = e.AccountedBy,
                DisplayName = person is null ? string.Empty : person.Value.GivenName + " " + person.Value.FamilyName
            });
        }

        return new EvacuationDto
        {
            Id = x.Id, EventId = x.EventId, Kind = x.Kind, Status = x.Status, StartedAt = x.StartedAt, StartedBy = x.StartedBy, ClosedAt = x.ClosedAt,
            ClosedBy = x.ClosedBy, Note = x.Note, MusterPoint = policy.MusterPoint, MusterPointAr = policy.MusterPointAr, Total = entries.Count,
            Accounted = entries.Count(e => e.AccountedAt is not null), Entries = entries.ToArray(), Coverage = Coverage
        };
    }
}
