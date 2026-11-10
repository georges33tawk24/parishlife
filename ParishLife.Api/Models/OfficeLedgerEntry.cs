// Purpose: one office cash entry: an allowance received from parish Finance, an office purchase, or a reversal of an earlier entry.
// Main members: Id, ParishId, Kind, OccurredOn, Amount, Currency, Description, Supplier, EvidenceReference, MissingEvidenceReason,
// FinanceReference, ReversalOf, Status, DeleteReason, CreatedBy and UpdatedAt.

namespace ParishLife.Api.Models;

public class OfficeLedgerEntry
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // Allowance (adds office cash), Purchase (spends it) or Reversal (undoes an entry in a closed month).
    public string Kind { get; set; } = string.Empty;

    public DateOnly OccurredOn { get; set; }

    // Always positive; the kind gives the direction.
    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? Supplier { get; set; }

    public string? EvidenceReference { get; set; }

    public string? MissingEvidenceReason { get; set; }

    // For allowances: the Finance record that moved the cash, so consolidated reports do not count it twice.
    public string? FinanceReference { get; set; }

    public string? ReversalOf { get; set; }

    // Active or Removed (a draft taken out before its month was closed; kept for history).
    public string Status { get; set; } = "Active";

    public string? DeleteReason { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
