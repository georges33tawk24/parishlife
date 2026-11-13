// Purpose: issues the next numbered receipt for one posted, attributed gift.
// Main members: OperationId and ContributionId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class IssueReceiptDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    // Posted gift ids are 32 hex characters, with an r/c suffix for reversal or reclassification records.
    [Required]
    [RegularExpression("^[0-9a-f]{32}[rc]?$")]
    public string ContributionId { get; set; } = string.Empty;
}
