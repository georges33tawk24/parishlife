// Purpose: shares exact parish document keys and conditional fences across calendar, facility and reservation commands.
// Main functions: For, Fence, ReadEventAsync, RequireEditableEvent and ReservationsAsync prevent source/private edits and linked-write races.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Scheduling;

internal static class SchedulingScope
{
    internal static RecordScope For(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    internal static RecordChange Fence(Versioned<Parish> parish) => RecordChange.Replace("parish", "parish", parish.Value, parish.Version);
    internal static async Task<Versioned<CalendarEvent>> ReadEventAsync(IRecordTransactions records, string parish, string id, CancellationToken ct)
        => await records.ReadAsync<CalendarEvent>(For(parish), "event:" + id, ct) ?? throw Missing();
    internal static void RequireEditableEvent(CalendarEvent value, string actor)
    {
        if (value.Visibility == "Private" && value.CreatedBy != actor)
            throw Missing();
        if (value.SourceType is not null || value.SourceId is not null || value.MinistryId is not null || value.ClergyAccountIds?.Length > 0)
            throw new DomainException("source_command_required", "Change this event through its owning source workflow.", FailureKind.Conflict);
    }
    internal static Task<IReadOnlyList<Versioned<Reservation>>> ReservationsAsync(IRecordTransactions records, string parish, string id, CancellationToken ct)
        => records.CollectAsync<Reservation>(For(parish), "reservation", ct, 5000, new RecordCondition { Path = "eventId", Comparison = "eq", Value = id });
    internal static bool IsEnded(Reservation value) => value.Status is "Cancelled" or "Declined";
    internal static DomainException Missing() => new("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
}
