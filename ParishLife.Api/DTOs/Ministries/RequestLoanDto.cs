// Purpose: requests a loan of a ministry stock item, either by a current member for themselves or by a custodian for a member.
// Main members: OperationId, StockId, Quantity, Purpose and PersonId (custodian requests only).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class RequestLoanDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid StockId { get; set; }

    [Range(1, 1000)]
    public int Quantity { get; set; }

    [StringLength(1000)]
    public string? Purpose { get; set; } = null;

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;
}
