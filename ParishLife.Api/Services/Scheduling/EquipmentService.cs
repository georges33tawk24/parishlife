// Purpose: manages counted parish equipment, event-linked equipment bookings that cannot overcommit stock, and issue/return reconciliation.
// Main functions: SaveAsync, ListAsync, BookAsync, ActAsync and BookingsAsync; missing or damaged returns open a facility issue in the same transaction.
// Every booking change replaces the equipment record conditionally, so concurrent bookings of one item serialize instead of overcommitting.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Scheduling;

public class EquipmentService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    internal static string Key(string id) => "equipment:" + id;
    private static string BookingKey(string id) => "equipmentBooking:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested equipment is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_equipment_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> AuthorizeAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.FacilitiesManage, ct);
        await access.RequireModuleAsync(parish, "facilities", ct);
        return root;
    }

    public async Task<EquipmentDto> SaveAsync(string parish, string? id, SaveEquipmentDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "equipment:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        if (request.Quantity is < 0 or > 100000 || request.Status is not ("Serviceable" or "OutOfService" or "Retired"))
            throw new DomainException("invalid_input", "Use a quantity of 0–100000 and Serviceable, OutOfService or Retired.");
        FacilityEquipment item;
        RecordChange change;
        if (id is null)
        {
            item = new FacilityEquipment { Id = op.Id, ParishId = parish };
            change = RecordChange.Create(Key(item.Id), "equipment", item);
        }
        else
        {
            var row = await ReadAsync(parish, id, ct);
            item = row.Value;
            // Reducing stock below what overlapping active bookings already hold would silently overcommit them.
            var active = await ActiveBookingsAsync(parish, id, ct);
            var held = active.Select(b => active.Where(o => o.StartsAt < b.EndsAt && b.StartsAt < o.EndsAt).Sum(o => o.Quantity)).DefaultIfEmpty(0).Max();
            if (request.Quantity < held)
                throw State("The quantity cannot drop below units held by active bookings; cancel or return them first.");
            change = RecordChange.Replace(Key(item.Id), "equipment", item, Versions.Require(request.Version));
        }
        item.Name = Guard.Text(request.Name, "Name", 300);
        item.Quantity = request.Quantity;
        item.Storage = string.IsNullOrWhiteSpace(request.Storage) ? null : Guard.Text(request.Storage, "Storage", 300);
        item.Condition = string.IsNullOrWhiteSpace(request.Condition) ? null : Guard.Text(request.Condition, "Condition", 500);
        item.Status = request.Status;
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "facilities.equipment_save", item.Id, [Fence(root), change], new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<Page<Versioned<EquipmentDto>>> ListAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await AuthorizeAsync(parish, ct);
        var page = await records.PageAsync<FacilityEquipment>(Scope(parish), "equipment", size, cursor, ct);
        return new Page<Versioned<EquipmentDto>>
        {
            Items = page.Items.Select(r => new Versioned<EquipmentDto> { Version = r.Version, Value = Project(r.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<EquipmentBookingDto> BookAsync(string parish, string equipment, BookEquipmentDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "equipment-booking:v1:" + equipment);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadBookingAsync(parish, prior.Id, ct)).Value);
        var row = await ReadAsync(parish, equipment, ct);
        var occurrence = (await records.ReadAsync<CalendarEvent>(Scope(parish), "event:" + Guard.Id(request.EventId), ct))?.Value;
        if (occurrence is null || occurrence.ParishId != parish || occurrence.Status == "Cancelled" || occurrence.EndsAt <= op.At)
            throw State("Book equipment for an existing, uncancelled, future event.");
        if (row.Value.Status != "Serviceable")
            throw State("Only serviceable equipment can be booked.");
        // ponytail: sums every active booking overlapping the event, which is conservative (never overcommits) but can refuse
        // a booking whose overlaps do not overlap each other; switch to a sweep-line peak if parishes hit that limit.
        var overlapping = (await ActiveBookingsAsync(parish, equipment, ct))
            .Where(b => b.StartsAt < occurrence.EndsAt && occurrence.StartsAt < b.EndsAt).Sum(b => b.Quantity);
        if (request.Quantity < 1 || overlapping + request.Quantity > row.Value.Quantity)
            throw State("Not enough of this equipment is available for that event.");
        var booking = new EquipmentBooking
        {
            Id = op.Id, ParishId = parish, EquipmentId = equipment, EventId = occurrence.Id, Quantity = request.Quantity,
            StartsAt = occurrence.StartsAt, EndsAt = occurrence.EndsAt, CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "facilities.equipment_book", equipment,
            [Fence(root), RecordChange.Replace(Key(equipment), "equipment", row.Value, row.Version), RecordChange.Create(BookingKey(booking.Id), "equipmentBooking", booking)],
            new CommandResult { Id = booking.Id, Status = booking.Status }, ct);
        return Project(booking);
    }

    public async Task<EquipmentBookingDto> ActAsync(string parish, string bookingId, EquipmentBookingActionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "equipment-booking-action:v1:" + bookingId);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadBookingAsync(parish, bookingId, ct)).Value);
        var booking = (await ReadBookingAsync(parish, bookingId, ct)).Value;
        var equipment = await ReadAsync(parish, booking.EquipmentId, ct);
        var changes = new List<RecordChange> { Fence(root) };
        switch (request.Action)
        {
            case "issue" when booking.Status == "Booked":
                booking.IssuedTo = Guard.Text(request.IssuedTo, "Issued to", 300);
                booking.IssuedAt = op.At;
                booking.Status = "Issued";
                break;
            case "return" when booking.Status == "Issued":
                if (request.ReturnedQuantity is not { } returned || returned < 0 || returned > booking.Quantity || request.Condition is not ("Good" or "Damaged"))
                    throw new DomainException("invalid_input", "Record the returned quantity (0 to the booked quantity) and Good or Damaged.");
                var missing = booking.Quantity - returned;
                booking.ReturnedQuantity = returned;
                booking.ReturnCondition = request.Condition;
                booking.ReturnedAt = op.At;
                booking.Status = "Returned";
                if (missing > 0 || request.Condition == "Damaged")
                {
                    // Missing or damaged units become an explicit, evidenced issue; nothing is silently deleted or charged.
                    var evidence = Guard.Text(request.Evidence, "Return evidence", 1000);
                    if (missing > 0)
                        equipment.Value.Quantity -= missing;
                    changes.Add(RecordChange.Create("facilityIssue:" + op.Id, "facilityIssue", new FacilityIssue
                    {
                        Id = op.Id, ParishId = parish, ResourceId = booking.EquipmentId, ResourceKind = "Equipment",
                        Description = (missing > 0 ? missing + " unit(s) missing" : "Damage reported") + " on return of booking " + booking.Id,
                        Evidence = evidence, ReportedBy = actor.AccountId, ReportedAt = op.At
                    }));
                }
                break;
            case "cancel" when booking.Status == "Booked":
                booking.Reason = Guard.Text(request.Reason, "Cancellation reason", 2000);
                booking.Status = "Cancelled";
                break;
            default:
                throw State("This booking action is not available in its current state.");
        }
        equipment.Value.UpdatedBy = actor.AccountId;
        equipment.Value.UpdatedAt = op.At;
        changes.Add(RecordChange.Replace(Key(equipment.Value.Id), "equipment", equipment.Value, equipment.Version));
        changes.Add(RecordChange.Replace(BookingKey(booking.Id), "equipmentBooking", booking, Versions.Require(request.Version)));
        await records.CommitAsync(Scope(parish), op, "facilities.equipment_" + request.Action, booking.EquipmentId, changes,
            new CommandResult { Id = booking.Id, Status = booking.Status }, ct);
        return Project(booking);
    }

    public async Task<Page<Versioned<EquipmentBookingDto>>> BookingsAsync(string parish, string equipment, int size, string? cursor, CancellationToken ct)
    {
        await AuthorizeAsync(parish, ct);
        await ReadAsync(parish, equipment, ct);
        var page = await records.PageAsync<EquipmentBooking>(Scope(parish), "equipmentBooking", size, cursor, ct,
            new RecordCondition { Path = "equipmentId", Comparison = "eq", Value = equipment });
        return new Page<Versioned<EquipmentBookingDto>>
        {
            Items = page.Items.Select(r => new Versioned<EquipmentBookingDto> { Version = r.Version, Value = Project(r.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    private async Task<List<EquipmentBooking>> ActiveBookingsAsync(string parish, string equipment, CancellationToken ct)
        => (await records.CollectAsync<EquipmentBooking>(Scope(parish), "equipmentBooking", ct, 2000,
            new RecordCondition { Path = "equipmentId", Comparison = "eq", Value = equipment }))
            .Select(r => r.Value).Where(b => b.Status is "Booked" or "Issued").ToList();

    internal async Task<Versioned<FacilityEquipment>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<FacilityEquipment>(Scope(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private async Task<Versioned<EquipmentBooking>> ReadBookingAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<EquipmentBooking>(Scope(parish), BookingKey(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static EquipmentDto Project(FacilityEquipment x) => new()
    {
        Id = x.Id, Name = x.Name, Quantity = x.Quantity, Storage = x.Storage, Condition = x.Condition, Status = x.Status,
        UpdatedBy = x.UpdatedBy, UpdatedAt = x.UpdatedAt
    };

    private static EquipmentBookingDto Project(EquipmentBooking x) => new()
    {
        Id = x.Id, EquipmentId = x.EquipmentId, EventId = x.EventId, Quantity = x.Quantity, StartsAt = x.StartsAt, EndsAt = x.EndsAt,
        Status = x.Status, IssuedTo = x.IssuedTo, IssuedAt = x.IssuedAt, ReturnedQuantity = x.ReturnedQuantity, ReturnCondition = x.ReturnCondition,
        ReturnedAt = x.ReturnedAt, CreatedBy = x.CreatedBy, Reason = x.Reason
    };
}
