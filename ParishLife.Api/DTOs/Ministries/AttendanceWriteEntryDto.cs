// Purpose: validates one explicit attendance observation or pre-closure correction.
// Main members: PersonId, Version, Status, CorrectionReason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceWriteEntryDto
{
    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(20)]
    public string Status { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? CorrectionReason { get; set; }
}
