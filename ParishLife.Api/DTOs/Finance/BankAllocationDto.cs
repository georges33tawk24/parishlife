// Purpose: one requested or shown bank line allocation.
// Main members: Kind, RecordId, Amount and Note.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Finance;

public class BankAllocationDto
{
    [Required]
    [RegularExpression("^(Contribution|Expense|Fee|Other)$")]
    public string Kind { get; set; } = string.Empty;

    [StringLength(64)]
    public string? RecordId { get; set; } = null;

    public decimal Amount { get; set; }

    [StringLength(300)]
    public string? Note { get; set; } = null;
}
