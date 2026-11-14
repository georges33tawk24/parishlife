// Purpose: typed read shape of the audit row every committed operation writes next to its changes; it never holds request bodies or credentials.
// Main members: ActorId, Action, ResourceId, OperationId, At, Reason and ActingAppointmentId.

namespace ParishLife.Api.Models;

public class AuditRecord
{
    public string ActorId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string ResourceId { get; set; } = string.Empty;

    public string OperationId { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public string? Reason { get; set; } = null;

    public string? ActingAppointmentId { get; set; } = null;
}
