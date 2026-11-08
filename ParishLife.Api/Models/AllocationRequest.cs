// Purpose: represents allocation request business state and rules.
// Main members: ResourceId, ParishId, BookingId, StartsAt, EndsAt, Quantity, Capacity.

namespace ParishLife.Api.Models;

public class AllocationRequest
{
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(500)]
    public string ResourceId { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(500)]
    public string ParishId { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(500)]
    public string BookingId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int Quantity { get; set; }

    public int Capacity { get; set; }
}
