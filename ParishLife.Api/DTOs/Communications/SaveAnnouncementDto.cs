// Purpose: creates or edits a draft announcement; Version is required when editing. TitleAr/BodyAr optionally add an Arabic version.
// Main members: OperationId, Version, Visibility, MinistryId, Title, Body, TitleAr, BodyAr, Category, Language, Priority, Pinned and ExpiresAt.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class SaveAnnouncementDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [RegularExpression("^(Public|Members|Ministry)$")]
    public string Visibility { get; set; } = "Members";

    [NotEmptyGuid]
    public Guid? MinistryId { get; set; } = null;

    [Required]
    [StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(20000)]
    public string Body { get; set; } = string.Empty;

    [StringLength(300)]
    public string? TitleAr { get; set; } = null;

    [StringLength(20000)]
    public string? BodyAr { get; set; } = null;

    [StringLength(100)]
    public string? Category { get; set; } = null;

    [Required]
    [RegularExpression("^(en|fr|ar)$")]
    public string Language { get; set; } = "en";

    [RegularExpression("^(Normal|Urgent)$")]
    public string Priority { get; set; } = "Normal";

    public bool Pinned { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; } = null;
}
