// Purpose: builds the member's own schedule across parishes where their account is linked to a person, and a priest's own duty
// schedule in one parish, with a one-off iCalendar export. Only records the viewer may already see are included.
// Main functions: MineAsync, PriestAsync and ToICalendar.

using System.Globalization;
using System.Text;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Scheduling;

public class ScheduleService(IRecordTransactions records, IParishRepository parishes, IClergyAuthority clergy, MinistryAccess own, ICurrentActor actor,
    MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Parish(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };

    private static void Window(DateTimeOffset from, DateTimeOffset to)
    {
        if (to <= from || to - from > TimeSpan.FromDays(92))
            throw new DomainException("invalid_input", "Choose a period of up to 92 days that ends after it starts.");
    }

    public async Task<IReadOnlyList<ScheduleItemDto>> MineAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        Window(from, to);
        var result = new List<ScheduleItemDto>();
        var account = new RecordScope { Area = RecordArea.Account, OwnerId = actor.AccountId };
        foreach (var follow in await records.CollectAsync<ParishFollow>(account, "parishFollow", ct, 200))
        {
            var parish = (await parishes.GetAsync(follow.Value.ParishId, ct))?.Value;
            Versioned<PersonAccountLink> link;
            try { link = await own.OwnLinkAsync(follow.Value.ParishId, ct); }
            catch (DomainException) { continue; }
            var scope = Parish(parish!.Id);
            var person = link.Value.PersonId;
            foreach (var r in await records.CollectAsync<EventRegistration>(scope, "registration", ct, 500, Equal("personId", person)))
                if (r.Value.Status is not ("Cancelled" or "Draft") && await records.ReadAsync<CalendarEvent>(scope, "event:" + r.Value.EventId, ct) is { } e
                    && e.Value.StartsAt < to && e.Value.EndsAt > from)
                    result.Add(Item(parish, "Registration", r.Value.Id, e.Value.Title, e.Value.StartsAt, e.Value.EndsAt, e.Value.TimeZone, null, r.Value.Status));
            foreach (var v in await records.CollectAsync<VolunteerAssignment>(scope, "volunteerAssignment", ct, 500, Equal("personId", person)))
                if (v.Value.Status is "Confirmed" or "AwaitingConfirmation" && v.Value.StartsAt < to && v.Value.EndsAt > from
                    && await records.ReadAsync<VolunteerOpportunity>(scope, "volunteerOpportunity:" + v.Value.OpportunityId, ct) is { } o)
                    result.Add(Item(parish, "Volunteering", v.Value.Id, o.Value.Title + " (" + o.Value.Position + ")", v.Value.StartsAt, v.Value.EndsAt, null, o.Value.Location, v.Value.Status));
            foreach (var s in await records.CollectAsync<SacramentRecord>(scope, "sacramentRecord", ct, 100, Equal("personId", person)))
                if (s.Value.Status == "Scheduled" && s.Value.ScheduledAt is { } at && at >= from && at < to)
                    result.Add(Item(parish, "Sacrament", s.Value.Id, s.Value.Kind, at, null, null, s.Value.Place, s.Value.Status));
        }
        return Sorted(result);
    }

    public async Task<IReadOnlyList<ScheduleItemDto>> PriestAsync(string parish, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        Window(from, to);
        var root = (await parishes.GetAsync(parish, ct))!.Value;
        var scope = Parish(parish);
        var result = new List<ScheduleItemDto>();
        // Duties only: the celebrant's scheduled sacraments and the priest's assigned requests with a confirmed date; no private notes or case details.
        foreach (var s in await records.CollectAsync<SacramentRecord>(scope, "sacramentRecord", ct, 2000, Equal("status", "Scheduled")))
            if (s.Value.CelebrantAccountId == actor.AccountId && s.Value.ScheduledAt is { } at && at >= from && at < to)
                result.Add(Item(root, "Sacrament", s.Value.Id, s.Value.Kind, at, null, null, s.Value.Place, s.Value.Status));
        foreach (var q in await records.CollectAsync<ParishRequest>(scope, "parishRequest", ct, 2000))
            if (q.Value.AssignedTo == actor.AccountId && q.Value.ConfirmedDate is { } date && date >= from && date < to && q.Value.Status is not ("Withdrawn" or "Cancelled" or "Declined"))
                result.Add(Item(root, "Request", q.Value.Id, q.Value.Reference + " " + q.Value.Kind, date, null, null, null, q.Value.Status));
        return Sorted(result);
    }

    // A one-off download for the signed-in viewer; revocable subscription feeds are not offered until operational.
    public string ToICalendar(IReadOnlyList<ScheduleItemDto> items)
    {
        static string Text(string value) => value.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\r", "").Replace("\n", "\\n");
        static string At(DateTimeOffset value) => value.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        var ics = new StringBuilder("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ParishLife//Schedule//EN\r\nCALSCALE:GREGORIAN\r\n");
        foreach (var item in items)
        {
            ics.Append("BEGIN:VEVENT\r\nUID:").Append(item.Kind).Append('-').Append(item.SourceId).Append("@parishlife\r\n")
                .Append("DTSTAMP:").Append(At(clock.GetUtcNow())).Append("\r\nDTSTART:").Append(At(item.StartsAt)).Append("\r\n");
            if (item.EndsAt is { } end) ics.Append("DTEND:").Append(At(end)).Append("\r\n");
            ics.Append("SUMMARY:").Append(Text(item.Title + " — " + item.ParishName)).Append("\r\n");
            if (item.Location is not null) ics.Append("LOCATION:").Append(Text(item.Location)).Append("\r\n");
            if (item.TimeZone is not null) ics.Append("DESCRIPTION:").Append(Text("Parish time zone: " + item.TimeZone)).Append("\r\n");
            ics.Append("END:VEVENT\r\n");
        }
        return ics.Append("END:VCALENDAR\r\n").ToString();
    }

    private static ScheduleItemDto Item(Parish parish, string kind, string id, string title, DateTimeOffset start, DateTimeOffset? end, string? zone, string? location, string status)
        => new() { ParishId = parish.Id, ParishName = parish.Name, Kind = kind, SourceId = id, Title = title, StartsAt = start, EndsAt = end, TimeZone = zone, Location = location, Status = status };

    private static IReadOnlyList<ScheduleItemDto> Sorted(List<ScheduleItemDto> items) => items.OrderBy(i => i.StartsAt).ThenBy(i => i.Kind, StringComparer.Ordinal).ToArray();
}
