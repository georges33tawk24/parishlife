// Purpose: requires actual reviewed reporting evidence before locking a completed attendance sheet.
// Main members: OperationId, Version, ReportingReference, Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceCloseDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(1000)]
    public string ReportingReference { get; set; } = string.Empty;

    [Required, StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
