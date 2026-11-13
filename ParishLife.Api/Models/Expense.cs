// Purpose: represents an expense claim or payable from draft through independent approval to actual payment.
// Main members: Id, ParishId, Description, DescriptionAr, FundId, Payee, IncurredOn, Amount, Currency, evidence facts, Status and actors.

namespace ParishLife.Api.Models;

public class Expense
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    // Optional Arabic twin, typed by the office; never translated from Description.
    public string? DescriptionAr { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public string Payee { get; set; } = string.Empty;

    public DateOnly IncurredOn { get; set; }

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string? EvidenceReference { get; set; } = null;

    // Required when no receipt exists; approval of the exception is explicit.
    public string? MissingEvidenceReason { get; set; } = null;

    // Draft, Submitted, Returned, Approved, Paid, Rejected or Cancelled.
    public string Status { get; set; } = "Draft";

    public string? Reason { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public string? SubmittedBy { get; set; } = null;

    public string? ApprovedBy { get; set; } = null;

    public bool MissingEvidenceApproved { get; set; }

    public string? PaidBy { get; set; } = null;

    public DateOnly? PaidOn { get; set; } = null;

    public string? PaymentReference { get; set; } = null;

    public DateTimeOffset UpdatedAt { get; set; }
}
