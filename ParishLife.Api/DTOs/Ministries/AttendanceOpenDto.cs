// Purpose: validates a request to open an actual completed confirmed meeting for an expected-roster snapshot.
// Main members: OperationId, MeetingVersion.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceOpenDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string MeetingVersion { get; set; } = string.Empty;
}
