// Purpose: represents record attendance input/output data.
// Main members: OperationId, MeetingVersion, Entries.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class RecordAttendanceDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string MeetingVersion { get; set; } = string.Empty;
    [Required]
    public AttendanceEntryDto[] Entries { get; set; } = Array.Empty<AttendanceEntryDto>();
}
