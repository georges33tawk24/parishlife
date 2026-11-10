// Purpose: one explicit part of a bank line matched to a posted gift, a paid expense, a bank fee or another reviewed item.
// Main members: Kind, RecordId, Amount and Note.

namespace ParishLife.Api.Models;

public class BankAllocation
{
    // Contribution, Expense, Fee or Other.
    public string Kind { get; set; } = string.Empty;

    public string? RecordId { get; set; }

    // Signed like the bank line: deposits positive, withdrawals negative.
    public decimal Amount { get; set; }

    public string? Note { get; set; }
}
