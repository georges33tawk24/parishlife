// Purpose: validates a bounded all-or-nothing attendance entry batch.
// Main members: OperationId, Version, Entries.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceWriteDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, MinLength(1), MaxLength(25)]
    public AttendanceWriteEntryDto[] Entries { get; set; } = Array.Empty<AttendanceWriteEntryDto>();
}
