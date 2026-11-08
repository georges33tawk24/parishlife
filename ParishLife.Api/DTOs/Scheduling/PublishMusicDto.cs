// Purpose: represents publish music input/output data.
// Main members: OperationId, Title, Language, Content, RightsStatement, DownloadAllowed, SupersedesId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class PublishMusicDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Language { get; set; } = string.Empty;

    [Required]
    [StringLength(100000)]
    public string Content { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string RightsStatement { get; set; } = string.Empty;

    public bool DownloadAllowed { get; set; }
    [NotEmptyGuid]
    public Guid? SupersedesId { get; set; } = null;
}
