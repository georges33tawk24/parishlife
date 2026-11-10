// Purpose: creates or edits a draft announcement; Version is required when editing.
// Main members: OperationId, Version, Visibility, MinistryId, Title, Body, Category, Language, Pinned and ExpiresAt.

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

    [StringLength(100)]
    public string? Category { get; set; } = null;

    [Required]
    [RegularExpression("^(en|fr|ar)$")]
    public string Language { get; set; } = "en";

    public bool Pinned { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; } = null;
}
