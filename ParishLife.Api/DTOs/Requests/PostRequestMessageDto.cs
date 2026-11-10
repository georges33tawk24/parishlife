// Purpose: posts a message on a request: applicant-visible, or an internal office note.
// Main members: OperationId, Audience and Body.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class PostRequestMessageDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(Applicant|Internal)$")]
    public string Audience { get; set; } = "Applicant";

    [Required]
    [StringLength(4000)]
    public string Body { get; set; } = string.Empty;
}
