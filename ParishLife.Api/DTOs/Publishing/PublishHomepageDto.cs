// Purpose: publishes exactly the draft version the operator reviewed.
// Main members: OperationId, Version (the draft version) and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Publishing;

public class PublishHomepageDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Reason { get; set; } = null;
}
