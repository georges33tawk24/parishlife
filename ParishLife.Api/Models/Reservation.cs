// Purpose: tracks a facility reservation and its recoverable resource-allocation attempt.
// Main members: Id, ParishId, ResourceId, EventId, RequestedBy, StartsAt, EndsAt, and related workflow details.

namespace ParishLife.Api.Models;

public class Reservation
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ResourceId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string RequestedBy { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public string[] AllocationResourceIds { get; set; } = Array.Empty<string>();

    public string? CustomerId { get; set; } = null;

    public string? TermsSnapshot { get; set; } = null;

    public DateTimeOffset? HoldUntil { get; set; } = null;

    public string? CurrentWorkId { get; set; } = null;

    public string? LastActionReason { get; set; }
}
