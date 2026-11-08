// Purpose: represents return loan input/output data.
// Main members: OperationId, Version, Quantity, Condition.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class ReturnLoanDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public int Quantity { get; set; }

    [Required]
    [StringLength(500)]
    public string Condition { get; set; } = string.Empty;
}
