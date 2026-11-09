// Purpose: advances only the server-stored bounded snapshot cursor for the exact current sheet version.
// Main members: OperationId, Version.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceSnapshotDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;
}
