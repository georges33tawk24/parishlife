// Purpose: shows a bank month reconciliation.
// Main members: BankAccount, Period, Status, LineCount, Totals, OutstandingLineIds, ReviewedBy, ReviewedAt, ReopenedBy and ReopenReason.

namespace ParishLife.Api.DTOs.Finance;

public class BankReconciliationDto
{
    public string BankAccount { get; set; } = string.Empty;

    public string Period { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public int LineCount { get; set; }

    public Dictionary<string, decimal> Totals { get; set; } = new();

    public string[] OutstandingLineIds { get; set; } = Array.Empty<string>();

    public string ReviewedBy { get; set; } = string.Empty;

    public DateTimeOffset ReviewedAt { get; set; }

    public string? ReopenedBy { get; set; }

    public string? ReopenReason { get; set; }
}
