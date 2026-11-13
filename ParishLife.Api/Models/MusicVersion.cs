// Purpose: represents one reviewed version of a music work with its metadata, materials and per-use rights.
// Main members: Id, ParishId, WorkId, Title, metadata, Lyrics, Chords, Notes, MediaLinks, RightsBasis, Attribution, use permissions, Status, SupersedesId and creation facts; optional Arabic twins TitleAr and SeasonAr.

namespace ParishLife.Api.Models;

public class MusicVersion
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // Shared by every version of the same work.
    public string WorkId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public string[] AlternateTitles { get; set; } = Array.Empty<string>();

    public string Language { get; set; } = string.Empty;

    public string? Rite { get; set; } = null;

    public string? Season { get; set; } = null;

    public string? SeasonAr { get; set; } = null;

    public string? Composer { get; set; } = null;

    public string? MusicalKey { get; set; } = null;

    public string? Instrumentation { get; set; } = null;

    public string? Category { get; set; } = null;

    public string? Lyrics { get; set; } = null;

    public string? Chords { get; set; } = null;

    public string? Notes { get; set; } = null;

    public string[] MediaLinks { get; set; } = Array.Empty<string>();

    // The actual source/licence or permission; possession of a file is not a right.
    public string RightsBasis { get; set; } = string.Empty;

    public string? Attribution { get; set; } = null;

    public bool DownloadAllowed { get; set; }

    public bool PrintAllowed { get; set; }

    public bool ProjectionAllowed { get; set; }

    // Active, Superseded or Withdrawn.
    public string Status { get; set; } = "Active";

    public string? SupersedesId { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
