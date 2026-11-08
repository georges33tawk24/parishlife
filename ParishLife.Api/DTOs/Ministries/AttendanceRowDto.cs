// Purpose: represents attendance row input/output data.
// Main members: PersonId, Status, Version.

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceRowDto
{
    public string PersonId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? Version { get; set; }
}
