// Purpose: one step on a rental agreement: approve, accept, record a deposit/fee, refund or retain the deposit, or waive part of the fee.
// Main members: OperationId, Version, Action, Amount, On, Reference and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class RentalActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(approve|accept|deposit-received|fee-received|refund-deposit|retain-deposit|waive-fee)$")]
    public string Action { get; set; } = string.Empty;

    public decimal? Amount { get; set; } = null;

    public DateOnly? On { get; set; } = null;

    [StringLength(300)]
    public string? Reference { get; set; } = null;

    [StringLength(1000)]
    public string? Reason { get; set; } = null;
}
