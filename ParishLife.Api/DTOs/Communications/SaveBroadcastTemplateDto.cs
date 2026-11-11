// Purpose: creates or edits a draft broadcast template; Version is required when editing.
// Main members: OperationId, Version, Name, Title, Body and Language.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class SaveBroadcastTemplateDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(20000)]
    public string Body { get; set; } = string.Empty;

    [Required, RegularExpression("^(en|fr|ar)$")]
    public string Language { get; set; } = "en";
}
