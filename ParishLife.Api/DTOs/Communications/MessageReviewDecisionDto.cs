// Purpose: records an independent platform reviewer's approval or refusal of an exact-message review request.
// Main members: OperationId, Version, Approve (required explicit choice), Reason and AccessMinutes (required when approving).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class MessageReviewDecisionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Approve { get; set; } = null;

    [Required, StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    // A technical bound on one access window, not an agreed review policy.
    [Range(5, 1440)]
    public int? AccessMinutes { get; set; } = null;
}
