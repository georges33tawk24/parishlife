// Purpose: creates or edits a draft broadcast; a TemplateId copies an approved template's wording, otherwise Title/Body/Language are required.
// Main members: OperationId, Version, Audience, MinistryId, TemplateId, Title, Body and Language.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class SaveBroadcastDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required, RegularExpression("^(Members|Ministry)$")]
    public string Audience { get; set; } = "Members";

    [NotEmptyGuid]
    public Guid? MinistryId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? TemplateId { get; set; } = null;

    [StringLength(300)]
    public string? Title { get; set; } = null;

    [StringLength(20000)]
    public string? Body { get; set; } = null;

    [RegularExpression("^(en|fr|ar)$")]
    public string? Language { get; set; } = null;
}
