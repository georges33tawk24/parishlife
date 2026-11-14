// Purpose: represents counted parish equipment that can be booked for events and issued/returned.
// Main members: Id, ParishId, Name, NameAr, Quantity, Storage, Condition, ConditionGrade, Status and change facts.

namespace ParishLife.Api.Models;

public class FacilityEquipment
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    // Units the parish actually holds; missing units are removed explicitly.
    public int Quantity { get; set; }

    public string? Storage { get; set; } = null;

    public string? Condition { get; set; } = null;

    // Good, Fair or NeedsService; null when nobody has graded it.
    public string? ConditionGrade { get; set; } = null;

    // Serviceable, OutOfService or Retired.
    public string Status { get; set; } = "Serviceable";

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
