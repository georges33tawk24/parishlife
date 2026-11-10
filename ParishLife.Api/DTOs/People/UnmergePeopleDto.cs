// Purpose: undoes a merge after review.
// Main members: OperationId, Version and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class UnmergePeopleDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
