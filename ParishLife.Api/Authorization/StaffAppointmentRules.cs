// Purpose: validates explicitly delegated staff duties and half-open appointment/head intervals without inventing church policy.
// Main functions: ValidateDuties, ValidateDates, Overlaps; named capability sets keep administrative and clergy authority distinct.

using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Authorization;

public static class StaffAppointmentRules
{
    public static readonly IReadOnlySet<string> ArchdioceseDuties = new HashSet<string>(StringComparer.Ordinal)
    {
        "archdiocese.read", "archdiocese.appointments.read"
    };

    public static readonly IReadOnlySet<string> PriestDuties = new HashSet<string>(StringComparer.Ordinal)
    {
        Permissions.PeopleRead, Permissions.PeopleWrite, Permissions.ReportsRead,
        Permissions.ScheduleRead, Permissions.ScheduleManage, Permissions.SchedulePublish,
        Permissions.FacilitiesManage, Permissions.MinistriesManage, Permissions.RequestsManage,
        Permissions.SacramentsRecord, Permissions.DocumentsRelease, Permissions.RegistrationsManage, Permissions.CheckIn
    };

    public static void ValidateDuties(StaffAppointmentRole role, string[]? allows, string[]? denies)
    {
        var permitted = role == StaffAppointmentRole.ArchdioceseAdmin ? ArchdioceseDuties : PriestDuties;
        if (allows is null || denies is null || allows.Length + denies.Length > 64
            || allows.Any(value => value is null || !permitted.Contains(value))
            || denies.Any(value => value is null || !(permitted.Contains(value) || role == StaffAppointmentRole.Priest && value == Permissions.ClergyApprove))
            || allows.Distinct(StringComparer.Ordinal).Count() != allows.Length || denies.Distinct(StringComparer.Ordinal).Count() != denies.Length)
            throw new DomainException("invalid_staff_duties", "Use distinct supported duties for this exact role and scope.");
    }

    public static void ValidateDates(DateTimeOffset start, DateTimeOffset? end, DateTimeOffset acceptBy, DateTimeOffset? review, DateTimeOffset now)
    {
        Guard.Utc(start);
        Guard.Utc(acceptBy);
        if (acceptBy <= now || end is { } last && (Guard.Utc(last) <= start || last <= acceptBy)
            || review is { } due && (Guard.Utc(due) <= start || end is { } until && due >= until))
            throw new DomainException("invalid_appointment_dates", "Use a future acceptance deadline, a valid effective period, and an optional review date within that period.");
    }

    public static bool Overlaps(DateTimeOffset firstStart, DateTimeOffset? firstEnd, DateTimeOffset secondStart, DateTimeOffset? secondEnd)
        => (secondEnd is null || firstStart < secondEnd) && (firstEnd is null || secondStart < firstEnd);
}
