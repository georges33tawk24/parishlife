// Purpose: creates or updates a household; Version is required when updating.
// Main members: OperationId, Version, Name, NameAr, Address, Town, TownAr, Phone and EnvelopeId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class SaveHouseholdDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(200)]
    public string? NameAr { get; set; } = null;

    [StringLength(1000)]
    public string? Address { get; set; } = null;

    [StringLength(100)]
    public string? Town { get; set; } = null;

    [StringLength(100)]
    public string? TownAr { get; set; } = null;

    [StringLength(50)]
    public string? Phone { get; set; } = null;

    [StringLength(40)]
    public string? EnvelopeId { get; set; } = null;
}
