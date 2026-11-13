// Purpose: represents save facility input/output data.
// Main members: OperationId, Version, Name, NameAr, Kind, Capacity, SetupMinutes, CleanupMinutes, and related workflow details.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveFacilityDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; }

    [Required]
    [StringLength(500)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? NameAr { get; set; } = null;

    [Required]
    [StringLength(500)]
    public string Kind { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int Capacity { get; set; }

    [Range(0, 1440)]
    public int SetupMinutes { get; set; }

    [Range(0, 1440)]
    public int CleanupMinutes { get; set; }
    [Required]
    [MaxLength(20)]
    public Guid[] ExclusionResourceIds { get; set; } = Array.Empty<Guid>();

    [StringLength(500)]
    public string? PublicDescription { get; set; } = null;

    [StringLength(500)]
    public string? PublicDescriptionAr { get; set; } = null;
}
