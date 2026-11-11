// Purpose: input for proposing a future-coverage payer transfer between a parish and a registered archdiocese; the proposer's own approval.
// Main members: OperationId, Direction (ToArchdiocese or ToParish), EffectiveFrom, AcceptBy, Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Billing;

public class ProposePayerTransferDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(ToArchdiocese|ToParish)$")]
    public string Direction { get; set; } = string.Empty;

    public DateTimeOffset EffectiveFrom { get; set; }

    public DateTimeOffset AcceptBy { get; set; }

    [Required]
    [StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
