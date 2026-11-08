// Purpose: represents private departure reason input/output data.
// Main members: OperationId, Version, Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class PrivateDepartureReasonDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
