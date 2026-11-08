// Purpose: represents allocation spec business state and rules.
// Main members: ResourceId, StartsAt, EndsAt, Quantity, Capacity.

namespace ParishLife.Api.Models;

public class AllocationSpec
{
    public string ResourceId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int Quantity { get; set; }

    public int Capacity { get; set; }
}
