// Purpose: represents one append-only loan transition with the loan state before it.
// Main members: Id, MinistryId, PersonId, LoanId, Action, FromStatus, ToStatus, RecordedBy, RecordedAt, Reason and Previous.

namespace ParishLife.Api.Models;

public class MinistryLoanHistory
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string LoanId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string FromStatus { get; set; } = string.Empty;

    public string ToStatus { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? Reason { get; set; } = null;

    public MinistryLoan? Previous { get; set; } = null;
}
