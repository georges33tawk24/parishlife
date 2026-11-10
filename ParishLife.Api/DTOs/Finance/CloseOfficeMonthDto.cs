// Purpose: closes one office ledger month after review.
// Main members: OperationId and Period.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class CloseOfficeMonthDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^[0-9]{4}-(0[1-9]|1[0-2])$")]
    public string Period { get; set; } = string.Empty;
}
