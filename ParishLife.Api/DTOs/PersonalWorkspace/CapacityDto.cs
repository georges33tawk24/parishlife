// Purpose: one capacity the signed-in account currently holds and may explicitly choose to act in. Choosing it never adds another capacity's duties.
// Main members: Kind (Priest, ArchdioceseAdmin, Bishop, MinistryLeader, ParishGrant, PlatformOperator), AppointmentId (the value to send in
// X-ParishLife-Appointment, or null when the capacity is used without that header), ArchdioceseId, ParishId, MinistryId, ScopeName, IsHead,
// Capabilities (duties after explicit denials) and RequiresMfa.

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class CapacityDto
{
    public string Kind { get; set; } = string.Empty;

    public string? AppointmentId { get; set; } = null;

    public string? ArchdioceseId { get; set; } = null;

    public string? ParishId { get; set; } = null;

    public string? MinistryId { get; set; } = null;

    public string ScopeName { get; set; } = string.Empty;

    public bool IsHead { get; set; }

    public string[] Capabilities { get; set; } = Array.Empty<string>();

    public bool RequiresMfa { get; set; } = true;
}
