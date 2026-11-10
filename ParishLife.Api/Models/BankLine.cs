// Purpose: one imported bank statement line with its original values, batch and how it is matched.
// Main members: Id, ParishId, BankAccount, BatchId, PostedOn, Reference, Amount, Currency, Original, Status, Allocations, OutstandingReason,
// MatchedBy and MatchedAt.

namespace ParishLife.Api.Models;

public class BankLine
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string BankAccount { get; set; } = string.Empty;

    public string BatchId { get; set; } = string.Empty;

    public DateOnly PostedOn { get; set; }

    public string Reference { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Original { get; set; } = string.Empty;

    // Unmatched, Matched or Outstanding (explained difference still open).
    public string Status { get; set; } = "Unmatched";

    public List<BankAllocation> Allocations { get; set; } = new();

    public string? OutstandingReason { get; set; }

    public string? MatchedBy { get; set; }

    public DateTimeOffset? MatchedAt { get; set; }
}
