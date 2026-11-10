// Purpose: returns one equipment booking with issue and return facts.
// Main members: Id, EquipmentId, EventId, Quantity, StartsAt, EndsAt, Status, IssuedTo, IssuedAt, ReturnedQuantity, ReturnCondition, ReturnedAt, CreatedBy and Reason.

namespace ParishLife.Api.DTOs.Scheduling;

public class EquipmentBookingDto
{
    public string Id { get; set; } = string.Empty;

    public string EquipmentId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? IssuedTo { get; set; } = null;

    public DateTimeOffset? IssuedAt { get; set; } = null;

    public int ReturnedQuantity { get; set; }

    public string? ReturnCondition { get; set; } = null;

    public DateTimeOffset? ReturnedAt { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public string? Reason { get; set; } = null;
}
