// Purpose: allocates part of a posted gift to a pledge in the same currency.
// Main members: OperationId, ContributionId and Amount.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class AllocatePledgeDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid ContributionId { get; set; }

    [Range(typeof(decimal), "0.01", "1000000000000")]
    public decimal Amount { get; set; }
}
