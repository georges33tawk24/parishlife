// Purpose: an independent reviewer's reconciliation of one bank account for one month, which locks its lines until reopened with a reason.
// Main members: Id, ParishId, BankAccount, Period, Status, LineCount, Totals, OutstandingLineIds, ReviewedBy, ReviewedAt, ReopenedBy and ReopenReason.

namespace ParishLife.Api.Models;

public class BankReconciliation
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string BankAccount { get; set; } = string.Empty;

    // yyyy-MM.
    public string Period { get; set; } = string.Empty;

    // Closed or Reopened.
    public string Status { get; set; } = "Closed";

    public int LineCount { get; set; }

    public Dictionary<string, decimal> Totals { get; set; } = new();

    public string[] OutstandingLineIds { get; set; } = Array.Empty<string>();

    public string ReviewedBy { get; set; } = string.Empty;

    public DateTimeOffset ReviewedAt { get; set; }

    public string? ReopenedBy { get; set; }

    public string? ReopenReason { get; set; }
}
