// Purpose: pauses, resumes or cancels the caller's own report schedule at the version they reviewed.
// Main members: OperationId, Version, Action and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Reporting;

public class ReportScheduleActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(10)]
    public string Action { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Reason { get; set; } = null;
}
