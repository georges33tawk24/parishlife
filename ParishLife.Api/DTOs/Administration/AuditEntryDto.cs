// Purpose: one read-only audit-trail row: who did which recorded action to which resource and when. Free-text reasons are left out,
// and no request body, fingerprint or credential is ever part of an audit row.
// Main members: OperationId, ActorId, Action, ResourceId, At and ActingAppointmentId.

namespace ParishLife.Api.DTOs.Administration;

public class AuditEntryDto
{
    public string OperationId { get; set; } = string.Empty;

    public string ActorId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string ResourceId { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public string? ActingAppointmentId { get; set; } = null;
}
