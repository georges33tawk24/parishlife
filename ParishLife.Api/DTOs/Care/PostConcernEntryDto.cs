// Purpose: adds an entry with a fixed audience to a concern.
// Main members: OperationId, Kind and Body.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Care;

public class PostConcernEntryDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(ReviewerNote|MessageToSubmitter|InformationRequest|SubmitterMessage)$")]
    public string Kind { get; set; } = string.Empty;

    [Required]
    [StringLength(10000)]
    public string Body { get; set; } = string.Empty;
}
