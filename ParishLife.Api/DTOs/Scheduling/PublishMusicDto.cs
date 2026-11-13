// Purpose: publishes a new music work version, or a revision superseding an active version.
// Main members: OperationId, SupersedesId, Title, metadata, materials, RightsBasis, Attribution and per-use permissions; optional Arabic twins TitleAr and SeasonAr.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class PublishMusicDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid? SupersedesId { get; set; } = null;

    [Required]
    [StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [StringLength(300)]
    public string? TitleAr { get; set; } = null;

    [MaxLength(10)]
    public string[] AlternateTitles { get; set; } = Array.Empty<string>();

    [Required]
    [StringLength(10)]
    public string Language { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Rite { get; set; } = null;

    [StringLength(100)]
    public string? Season { get; set; } = null;

    [StringLength(100)]
    public string? SeasonAr { get; set; } = null;

    [StringLength(200)]
    public string? Composer { get; set; } = null;

    [StringLength(20)]
    public string? MusicalKey { get; set; } = null;

    [StringLength(200)]
    public string? Instrumentation { get; set; } = null;

    [StringLength(100)]
    public string? Category { get; set; } = null;

    [StringLength(50000)]
    public string? Lyrics { get; set; } = null;

    [StringLength(50000)]
    public string? Chords { get; set; } = null;

    [StringLength(5000)]
    public string? Notes { get; set; } = null;

    [MaxLength(10)]
    public string[] MediaLinks { get; set; } = Array.Empty<string>();

    [Required]
    [StringLength(2000)]
    public string RightsBasis { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Attribution { get; set; } = null;

    public bool DownloadAllowed { get; set; }

    public bool PrintAllowed { get; set; }

    public bool ProjectionAllowed { get; set; }
}
