// Purpose: ends a relationship pair with a reason; history is retained.
// Main members: OperationId, Version and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class EndRelationshipDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
