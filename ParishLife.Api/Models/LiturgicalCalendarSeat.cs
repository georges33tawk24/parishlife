// Purpose: the conditional pointer to the one approved calendar per archdiocese, rite and year, so two approvals cannot both become current.
// Main members: CalendarId.

namespace ParishLife.Api.Models;

public class LiturgicalCalendarSeat
{
    public string CalendarId { get; set; } = string.Empty;
}
