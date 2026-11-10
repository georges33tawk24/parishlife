// Purpose: asks for exceptional review of one exact inbox message, with a recorded purpose and an optional originating report.
// Main members: OperationId, ConversationId, MessageId, ReportId and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class RequestMessageReviewDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid ConversationId { get; set; }

    [NotEmptyGuid]
    public Guid MessageId { get; set; }

    [NotEmptyGuid]
    public Guid? ReportId { get; set; } = null;

    [Required, StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
