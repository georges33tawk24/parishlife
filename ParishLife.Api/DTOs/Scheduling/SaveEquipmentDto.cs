// Purpose: creates or updates counted equipment; Version is required when updating.
// Main members: OperationId, Version, Name, Quantity, Storage, Condition and Status.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveEquipmentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [StringLength(300)]
    public string Name { get; set; } = string.Empty;

    [Range(0, 100000)]
    public int Quantity { get; set; }

    [StringLength(300)]
    public string? Storage { get; set; } = null;

    [StringLength(500)]
    public string? Condition { get; set; } = null;

    [Required]
    [RegularExpression("^(Serviceable|OutOfService|Retired)$")]
    public string Status { get; set; } = "Serviceable";
}
