// Purpose: one dated observance in a liturgical calendar, as the authority supplied it (input and editor view).
// Main members: Date, Titles (en/fr/ar), Rank, Season and DisplayColor (#RRGGBB).

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Scheduling;

public class LiturgicalEntryDto
{
    [Required]
    public DateOnly? Date { get; set; }

    [Required]
    public Dictionary<string, string> Titles { get; set; } = new();

    [StringLength(80)]
    public string? Rank { get; set; } = null;

    [StringLength(80)]
    public string? Season { get; set; } = null;

    [RegularExpression("^#[0-9A-Fa-f]{6}$")]
    public string? DisplayColor { get; set; } = null;
}
