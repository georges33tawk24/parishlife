// Purpose: returns one append-only loan transition and the loan state before it.
// Main members: Id, LoanId, Action, FromStatus, ToStatus, RecordedBy, RecordedAt, Reason and Previous.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryLoanHistoryDto
{
    public string Id { get; set; } = string.Empty;

    public string LoanId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string FromStatus { get; set; } = string.Empty;

    public string ToStatus { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? Reason { get; set; } = null;

    public MinistryLoanDto? Previous { get; set; } = null;
}
