// Purpose: site-relative links from a directory card to the existing public reads and the existing signed-in follow action.
// Main members: Website, Calendar, Ministries, Profile, CalendarFeed (.ics), LiturgicalCalendar, Requests and
// Follow (POST, signed-in personal session only).

namespace ParishLife.Api.DTOs.Publishing;

public class PublicParishLinksDto
{
    public string Website { get; set; } = string.Empty;

    public string Calendar { get; set; } = string.Empty;

    public string Ministries { get; set; } = string.Empty;

    public string Profile { get; set; } = string.Empty;

    public string CalendarFeed { get; set; } = string.Empty;

    public string LiturgicalCalendar { get; set; } = string.Empty;

    public string Requests { get; set; } = string.Empty;

    public string Follow { get; set; } = string.Empty;
}
