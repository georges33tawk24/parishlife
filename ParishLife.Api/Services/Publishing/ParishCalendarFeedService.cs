// Purpose: a verified parish's public calendar as an iCalendar (RFC 5545) feed that calendar apps subscribe to. It contains only what the public
// calendar read already shows (explicitly published, public parish activities and their cancellations), over a bounded window, with a bounded
// number of events. No private, ministry, clergy or account data, and no liturgical content, is added.
// Main functions: FeedAsync builds the feed; Escape and Fold apply the RFC 5545 text rules.

using System.Text;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Services.Publishing;

public class ParishCalendarFeedService(CalendarService calendar, IParishRepository parishes, TimeProvider clock)
{
    internal const int PastDays = 30;
    internal const int FutureDays = 180;
    internal const int MaximumEvents = 500;
    private const int WindowDays = 30;

    public async Task<string> FeedAsync(string parish, CancellationToken ct)
    {
        var root = (await parishes.GetAsync(parish, ct))?.Value is { Status: ParishStatus.Verified } p ? p
            : throw new DomainException("resource_not_found", "The parish calendar is unavailable.", FailureKind.NotFound);
        var now = clock.GetUtcNow();
        var today = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);
        var events = new List<PublicCalendarEventDto>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var start = today.AddDays(-PastDays); start < today.AddDays(FutureDays) && events.Count < MaximumEvents; start = start.AddDays(WindowDays))
        {
            string? cursor = null;
            do
            {
                var page = await calendar.PublicAsync(parish, start, start.AddDays(WindowDays), 100, cursor, ct);
                foreach (var item in page.Items)
                    if (events.Count < MaximumEvents && seen.Add(item.Id))
                        events.Add(item);
                cursor = page.ContinuationToken;
            }
            while (cursor is not null && events.Count < MaximumEvents);
        }

        var text = new StringBuilder();
        void Line(string value) => text.Append(Fold(value)).Append("\r\n");
        Line("BEGIN:VCALENDAR");
        Line("VERSION:2.0");
        Line("PRODID:-//ParishLife//Public parish calendar//EN");
        Line("CALSCALE:GREGORIAN");
        Line("METHOD:PUBLISH");
        Line("X-WR-CALNAME:" + Escape(root.Name));
        Line("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
        Line("X-PUBLISHED-TTL:PT6H");
        foreach (var e in events.OrderBy(e => e.StartsAt).ThenBy(e => e.Id, StringComparer.Ordinal))
        {
            Line("BEGIN:VEVENT");
            Line("UID:" + e.Id + "@parishlife");
            Line("DTSTAMP:" + Utc(now));
            Line("DTSTART:" + Utc(e.StartsAt));
            Line("DTEND:" + Utc(e.EndsAt > e.StartsAt ? e.EndsAt : e.StartsAt.AddMinutes(1)));
            Line("SUMMARY:" + Escape(e.Title));
            if (!string.IsNullOrWhiteSpace(e.Description))
                Line("DESCRIPTION:" + Escape(e.Description));
            Line("STATUS:" + (e.Status == "Cancelled" ? "CANCELLED" : "CONFIRMED"));
            Line("END:VEVENT");
        }
        Line("END:VCALENDAR");
        return text.ToString();
    }

    private static string Utc(DateTimeOffset value) => value.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", System.Globalization.CultureInfo.InvariantCulture);

    // TEXT values: backslash, semicolon and comma are escaped, line breaks become \n and other control characters are dropped.
    internal static string Escape(string value)
    {
        var text = new StringBuilder(value.Length);
        foreach (var c in value.Replace("\r\n", "\n"))
            text.Append(c switch
            {
                '\\' => "\\\\",
                ';' => "\\;",
                ',' => "\\,",
                '\n' => "\\n",
                _ when char.IsControl(c) => string.Empty,
                _ => c.ToString()
            });
        return text.ToString();
    }

    // Content lines longer than 75 octets are folded with CRLF and a space, never inside a UTF-8 character.
    internal static string Fold(string line)
    {
        var result = new StringBuilder();
        var octets = 0;
        foreach (var rune in line.EnumerateRunes())
        {
            var size = rune.Utf8SequenceLength;
            if (octets + size > 75)
            {
                result.Append("\r\n ");
                octets = 1;
            }
            result.Append(rune.ToString());
            octets += size;
        }
        return result.ToString();
    }
}
