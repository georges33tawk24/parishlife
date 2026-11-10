// Purpose: submits a prayer intention with the most public use the submitter allows.
// Main members: OperationId, Text, RequestedVisibility and DisplayName.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class SubmitIntentionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(2000)]
    public string Text { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(ClergyPrivate|AnonymousPublic|IdentifiedPublic)$")]
    public string RequestedVisibility { get; set; } = "ClergyPrivate";

    [StringLength(200)]
    public string? DisplayName { get; set; } = null;
}
