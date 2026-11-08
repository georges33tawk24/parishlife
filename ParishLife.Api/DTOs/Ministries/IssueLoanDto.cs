// Purpose: represents issue loan input/output data.
// Main members: OperationId, StockId, PersonId, Quantity, DueAt, Condition.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class IssueLoanDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [NotEmptyGuid]
    public Guid StockId { get; set; }
    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    public int Quantity { get; set; }

    public DateTimeOffset DueAt { get; set; }

    [Required]
    [StringLength(500)]
    public string Condition { get; set; } = string.Empty;
}
