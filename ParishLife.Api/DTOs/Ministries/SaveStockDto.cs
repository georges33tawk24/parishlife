// Purpose: represents save stock input/output data.
// Main members: OperationId, Version, Name, Total.

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

    public int Total { get; set; }
}
