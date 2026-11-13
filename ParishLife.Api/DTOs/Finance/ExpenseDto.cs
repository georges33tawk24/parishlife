// Purpose: returns an expense with its evidence status and actors.
// Main members: Id, Description, DescriptionAr, FundId, Payee, IncurredOn, Amount, Currency, EvidenceReference, MissingEvidenceReason, MissingEvidenceApproved, Status, Reason, actors and payment facts.

namespace ParishLife.Api.DTOs.Finance;

public class ExpenseDto
{
    public string Id { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? DescriptionAr { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public string Payee { get; set; } = string.Empty;

    public DateOnly IncurredOn { get; set; }

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string? EvidenceReference { get; set; } = null;

    public string? MissingEvidenceReason { get; set; } = null;

    public bool MissingEvidenceApproved { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? Reason { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public string? SubmittedBy { get; set; } = null;

    public string? ApprovedBy { get; set; } = null;

    public string? PaidBy { get; set; } = null;

    public DateOnly? PaidOn { get; set; } = null;

    public string? PaymentReference { get; set; } = null;
}
