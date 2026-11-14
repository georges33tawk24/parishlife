// Purpose: returns a dated maintenance block and its actual allocation state (Allocating, Active, Conflict or Cancelled).
// Main members: Id, FacilityId, StartsAt, EndsAt, Reason, ReasonAr, InCharge, Status, ErrorCode and actor facts.

namespace ParishLife.Api.DTOs.Scheduling;

public class MaintenanceBlockDto
{
    public string Id { get; set; } = string.Empty;

    public string FacilityId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string? ReasonAr { get; set; } = null;

    public string? InCharge { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public string? ErrorCode { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? CancelledBy { get; set; } = null;

    public DateTimeOffset? CancelledAt { get; set; } = null;

    public string? CancelReason { get; set; } = null;
}
