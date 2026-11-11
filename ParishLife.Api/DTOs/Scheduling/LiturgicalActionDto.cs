// Purpose: a versioned decision on a liturgical calendar (approve, withdraw) or a parish exception (withdraw).
// Main members: OperationId, Version, Action and Reason (required to withdraw).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class LiturgicalActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, RegularExpression("^(approve|withdraw)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Reason { get; set; } = null;
}
