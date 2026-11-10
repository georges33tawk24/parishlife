// Purpose: returns one music version with metadata, permitted materials and rights.
// Main members: Id, WorkId, Title, metadata, Lyrics, Chords, Notes, MediaLinks, RightsBasis, Attribution, use permissions, Status, SupersedesId and creation facts.

namespace ParishLife.Api.DTOs.Scheduling;

public class MusicVersionDto
{
    public string Id { get; set; } = string.Empty;

    public string WorkId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string[] AlternateTitles { get; set; } = Array.Empty<string>();

    public string Language { get; set; } = string.Empty;

    public string? Rite { get; set; } = null;

    public string? Season { get; set; } = null;

    public string? Composer { get; set; } = null;

    public string? MusicalKey { get; set; } = null;

    public string? Instrumentation { get; set; } = null;

    public string? Category { get; set; } = null;

    public string? Lyrics { get; set; } = null;

    public string? Chords { get; set; } = null;

    public string? Notes { get; set; } = null;

    public string[] MediaLinks { get; set; } = Array.Empty<string>();

    public string RightsBasis { get; set; } = string.Empty;

    public string? Attribution { get; set; } = null;

    public bool DownloadAllowed { get; set; }

    public bool PrintAllowed { get; set; }

    public bool ProjectionAllowed { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? SupersedesId { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
