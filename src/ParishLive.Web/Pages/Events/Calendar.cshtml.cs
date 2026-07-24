using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Events;

namespace ParishLive.Web.Pages.Events;

[Authorize]
public class CalendarModel(IEventService events) : PageModel
{
    public record DayCell(int? Day, bool IsToday, List<EventListItem> Events);

    public int Year { get; private set; }
    public int Month { get; private set; }
    public List<List<DayCell>> Weeks { get; private set; } = new();
    public (int Year, int Month) Prev { get; private set; }
    public (int Year, int Month) Next { get; private set; }

    public async Task OnGetAsync(int? year, int? month)
    {
        var today = DateTime.Today;
        Year = year ?? today.Year;
        Month = month is >= 1 and <= 12 ? month.Value : today.Month;

        var first = new DateTime(Year, Month, 1);
        Prev = (first.AddMonths(-1).Year, first.AddMonths(-1).Month);
        Next = (first.AddMonths(1).Year, first.AddMonths(1).Month);

        var monthEvents = await events.ListForMonthAsync(Year, Month);
        var byDay = monthEvents.GroupBy(e => e.StartUtc.Day).ToDictionary(g => g.Key, g => g.ToList());

        var daysInMonth = DateTime.DaysInMonth(Year, Month);
        var firstColumn = ((int)first.DayOfWeek + 6) % 7; // Monday = 0

        var cells = new List<DayCell>();
        for (var i = 0; i < firstColumn; i++)
            cells.Add(new DayCell(null, false, new()));
        for (var d = 1; d <= daysInMonth; d++)
        {
            var isToday = Year == today.Year && Month == today.Month && d == today.Day;
            cells.Add(new DayCell(d, isToday, byDay.GetValueOrDefault(d, new())));
        }
        while (cells.Count % 7 != 0)
            cells.Add(new DayCell(null, false, new()));

        Weeks = cells.Chunk(7).Select(w => w.ToList()).ToList();
    }
}
