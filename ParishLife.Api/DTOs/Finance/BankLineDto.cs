// Purpose: shows a bank line with its original values and matching.
// Main members: Id, Version, BankAccount, BatchId, PostedOn, Reference, Amount, Currency, Original, Status, Allocations, OutstandingReason, MatchedBy and MatchedAt.

namespace ParishLife.Api.DTOs.Finance;

public class BankLineDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string BankAccount { get; set; } = string.Empty;

    public string BatchId { get; set; } = string.Empty;

    public DateOnly PostedOn { get; set; }

    public string Reference { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Original { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public BankAllocationDto[] Allocations { get; set; } = Array.Empty<BankAllocationDto>();

    public string? OutstandingReason { get; set; }

    public string? MatchedBy { get; set; }

    public DateTimeOffset? MatchedAt { get; set; }
}
