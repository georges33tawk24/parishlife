// Purpose: proposes the terms snapshot for an external reservation.
// Main members: OperationId, RenterId, Fee, Deposit, Currency and Terms.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class ProposeRentalDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid RenterId { get; set; }

    public decimal Fee { get; set; }

    public decimal Deposit { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string Currency { get; set; } = string.Empty;

    [Required]
    [StringLength(4000)]
    public string Terms { get; set; } = string.Empty;
}
