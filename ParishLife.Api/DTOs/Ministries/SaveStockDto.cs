// Purpose: creates or updates one counted ministry stock item; Version is required when updating.
// Main members: OperationId, Version, Name/NameAr, Storage/StorageAr, Total and Status (Active or Retired).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SaveStockDto
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

    [StringLength(500)]
    public string? Storage { get; set; } = null;

    [StringLength(500)]
    public string? StorageAr { get; set; } = null;

    [Range(0, 100000)]
    public int Total { get; set; }

    [Required]
    [RegularExpression("^(Active|Retired)$")]
    public string Status { get; set; } = "Active";
}
