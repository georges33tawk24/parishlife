// Purpose: permits room work for a real ministry-owned occurrence without weakening the manual calendar source boundary.
// Main functions: RequireAsync checks the exact meeting/calendar pair and current group authority; CanReadAsync keeps other facility readers on a busy-only projection.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Scheduling;

public class ReservationMeetingAccess(IRecordTransactions records, MinistryAccess access, ICurrentActor actor)
{
    internal async Task RequireAsync(string parish, CalendarEvent occurrence, bool allocation, CancellationToken ct)
    {
        if (occurrence.SourceType is null && occurrence.MinistryId is null && occurrence.SourceId is null)
        {
            SchedulingScope.RequireEditableEvent(occurrence, actor.AccountId);
            return;
        }
        if (occurrence.SourceType != "MinistryMeeting" || occurrence.MinistryId is not { } ministry || occurrence.SourceId is not { } id)
            throw SchedulingScope.Missing();
        var group = await access.LeaderAsync(parish, ministry, ct, requireModule: allocation);
        if (allocation && group.Value.Status != "Active") throw SchedulingScope.Missing();
        var meeting = await records.ReadAsync<MinistryMeeting>(SchedulingScope.For(parish), "ministryMeeting:" + id, ct);
        if (meeting is null || !Matches(parish, occurrence, meeting.Value)) throw SchedulingScope.Missing();
    }
    internal async Task<bool> CanReadAsync(string parish, CalendarEvent occurrence, CancellationToken ct)
    {
        try { await RequireAsync(parish, occurrence, false, ct); return true; }
        catch (DomainException error) when (error.Kind is FailureKind.Forbidden or FailureKind.NotFound) { return false; }
    }
    internal static bool Matches(string parish, CalendarEvent occurrence, MinistryMeeting meeting)
        => occurrence.ParishId == parish && meeting.ParishId == parish && occurrence.SourceType == "MinistryMeeting"
        && occurrence.SourceId == meeting.Id && occurrence.MinistryId == meeting.MinistryId && occurrence.Id == meeting.EventId
        && occurrence.Kind == "MinistryMeeting" && occurrence.Visibility == "Ministry" && !occurrence.Published
        && occurrence.ClergyAccountIds?.Length is not > 0 && occurrence.Status == meeting.Status
        && occurrence.StartsAt == meeting.StartsAt && occurrence.EndsAt == meeting.EndsAt && occurrence.TimeZone == meeting.TimeZone;
}
