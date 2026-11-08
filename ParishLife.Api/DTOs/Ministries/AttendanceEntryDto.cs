// Purpose: represents attendance entry input/output data.
// Main members: PersonId, Status, Version, EvidenceReference, CorrectionReason.

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceEntryDto
{
    public Guid PersonId { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? Version { get; set; } = null;

    public string? EvidenceReference { get; set; } = null;

    public string? CorrectionReason { get; set; } = null;
}
