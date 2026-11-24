// Purpose: a ParishLife operator grants a parish free (complimentary) coverage (owner decision, 23 November 2026): no invoice, receipt or
// cash payment; the audit records who granted it and why.
// Main members: OperationId, Modules (core is always included), StartsAt, EndsAt (empty = no end), Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Billing;

public class GrantFreeCoverageDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [MaxLength(20)]
    public string[] Modules { get; set; } = Array.Empty<string>();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}
