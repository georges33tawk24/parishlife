// Purpose: preserves an immutable ministry leadership change and the exact appointment snapshot at that time.
// Main members: Id, MinistryId, AccountId, Action, RecordedBy, RecordedAt and Appointment.

namespace ParishLife.Api.Models;

public class MinistryLeadershipHistory
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? EvidenceReference { get; set; }

    public string? Reason { get; set; }

    public MinistryLeader Appointment { get; set; } = new();
}
