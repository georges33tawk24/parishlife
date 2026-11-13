// Purpose: returns equipment with its total and status.
// Main members: Id, Name, NameAr, Quantity, Storage, Condition, ConditionGrade, Status, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.DTOs.Scheduling;

public class EquipmentDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public int Quantity { get; set; }

    public string? Storage { get; set; } = null;

    public string? Condition { get; set; } = null;

    // Good, Fair or NeedsService; null when nobody has graded it.
    public string? ConditionGrade { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
