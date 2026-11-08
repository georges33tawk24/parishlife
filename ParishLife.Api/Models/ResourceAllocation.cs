// Purpose: represents resource allocation business state and rules.
// Main members: Id, OperationId, ParishId, ResourceId, StartsAt, EndsAt, Quantity, and related workflow details.

namespace ParishLife.Api.Models;

public class ResourceAllocation
{
    public string Id { get; set; } = string.Empty;

    public string OperationId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ResourceId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int Quantity { get; set; }

    public int Capacity { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset? ExpiresAt { get; set; }

    public string BookingId { get; set; } = string.Empty;
}
