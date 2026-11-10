// Purpose: creates a parish fund.
// Main members: OperationId, Name, Purpose and Restricted.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveFundDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(1000)]
    public string Purpose { get; set; } = string.Empty;

    public bool Restricted { get; set; }
}
