// Purpose: represents a quantity of equipment held for one calendar event, through issue and return.
// Main members: Id, ParishId, EquipmentId, EventId, Quantity, StartsAt, EndsAt, Status, issue/return facts and actors.

namespace ParishLife.Api.Models;

public class EquipmentBooking
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string EquipmentId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    // Booked, Issued, Returned or Cancelled.
    public string Status { get; set; } = "Booked";

    public string? IssuedTo { get; set; } = null;

    public DateTimeOffset? IssuedAt { get; set; } = null;

    public int ReturnedQuantity { get; set; }

    public string? ReturnCondition { get; set; } = null;

    public DateTimeOffset? ReturnedAt { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? Reason { get; set; } = null;
}
