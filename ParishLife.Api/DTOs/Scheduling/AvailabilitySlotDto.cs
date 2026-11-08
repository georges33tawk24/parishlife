// Purpose: represents availability slot input/output data.
// Main members: StartsAt, EndsAt, Status.

namespace ParishLife.Api.DTOs.Scheduling;

public class AvailabilitySlotDto
{
    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string Status { get; set; } = string.Empty;
}
