// Purpose: a dated maintenance block that occupies a room or space through the same resource guards that reservations use,
// so a block and a confirmed reservation can never hold the room at the same time.
// Main members: Id, ParishId, FacilityId, StartsAt, EndsAt, Reason, ReasonAr, InCharge, Status, Resources, ErrorCode and actor facts.

namespace ParishLife.Api.Models;

public class MaintenanceBlock
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string FacilityId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string? ReasonAr { get; set; } = null;

    // Who is in charge, as the office typed it (a name or team, not an account).
    public string? InCharge { get; set; } = null;

    // Allocating, Active, Conflict or Cancelled.
    public string Status { get; set; } = "Allocating";

    // The exact resource guards held, kept so a release uses them even after the room's configuration changes.
    public AllocationSpec[] Resources { get; set; } = Array.Empty<AllocationSpec>();

    public string? ErrorCode { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? CancelledBy { get; set; } = null;

    public DateTimeOffset? CancelledAt { get; set; } = null;

    public string? CancelReason { get; set; } = null;
}
