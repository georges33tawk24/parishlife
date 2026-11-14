// Purpose: one dated observance exactly as the competent authority supplied it in a liturgical calendar version.
// Main members: Date, Titles (en/fr/ar), optional Rank and Season labels with their Arabic twins RankAr and SeasonAr (as the authority
// supplied them, never translated), and an optional DisplayColor (#RRGGBB) used for public decoration.

namespace ParishLife.Api.Models;

public class LiturgicalEntry
{
    public DateOnly Date { get; set; }

    public Dictionary<string, string> Titles { get; set; } = [];

    public string? Rank { get; set; } = null;

    public string? Season { get; set; } = null;

    public string? RankAr { get; set; } = null;

    public string? SeasonAr { get; set; } = null;

    public string? DisplayColor { get; set; } = null;
}
