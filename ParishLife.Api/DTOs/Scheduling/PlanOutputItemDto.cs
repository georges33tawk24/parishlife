// Purpose: returns one item of an audience-specific plan output.
// Main members: Title, StartsAt, EndsAt, ResponsibleRole, AssignedAccountId, Instructions, MusicTitle and MusicText; optional Arabic twins TitleAr, InstructionsAr and MusicTitleAr.

namespace ParishLife.Api.DTOs.Scheduling;

public class PlanOutputItemDto
{
    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string? ResponsibleRole { get; set; } = null;

    public string? AssignedAccountId { get; set; } = null;

    public string? Instructions { get; set; } = null;

    public string? InstructionsAr { get; set; } = null;

    public string? MusicTitle { get; set; } = null;

    public string? MusicTitleAr { get; set; } = null;

    // Lyrics/chords only where the version allows printing.
    public string? MusicText { get; set; } = null;

    public string? Attribution { get; set; } = null;
}
