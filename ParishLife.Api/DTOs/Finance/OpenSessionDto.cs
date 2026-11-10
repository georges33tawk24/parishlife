// Purpose: opens a counting session for one collection source and date.
// Main members: OperationId, Source and CollectedOn.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class OpenSessionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string Source { get; set; } = string.Empty;

    public DateOnly CollectedOn { get; set; }
}
