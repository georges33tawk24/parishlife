// Purpose: matches a bank line through explicit allocations, marks it outstanding, or undoes a match.
// Main members: OperationId, Version, Action, Allocations and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class BankLineActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(match|outstanding|unmatch)$")]
    public string Action { get; set; } = string.Empty;

    [MaxLength(20)]
    public BankAllocationDto[] Allocations { get; set; } = Array.Empty<BankAllocationDto>();

    [StringLength(1000)]
    public string? Reason { get; set; } = null;
}
