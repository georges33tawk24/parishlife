// Purpose: one public liturgical observance for display and decoration, attributed to its approved calendar; parish exceptions are flagged so
// they stay distinguishable from the authority's calendar facts. Internal reasons and editor identities are never included.
// Main members: Date, Title, Language (actual language served), Rank, Season, RankAr and SeasonAr (the authority's Arabic labels, null when it
// supplied none; never translated), DisplayColor, Rite, Source, CalendarVersion, CalendarId and
// ParishException.

namespace ParishLife.Api.DTOs.Scheduling;

public class PublicLiturgicalDayDto
{
    public DateOnly Date { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string? Rank { get; set; } = null;

    public string? Season { get; set; } = null;

    public string? RankAr { get; set; } = null;

    public string? SeasonAr { get; set; } = null;

    public string? DisplayColor { get; set; } = null;

    public string Rite { get; set; } = string.Empty;

    public string Source { get; set; } = string.Empty;

    public string CalendarVersion { get; set; } = string.Empty;

    public string CalendarId { get; set; } = string.Empty;

    public bool ParishException { get; set; }
}
