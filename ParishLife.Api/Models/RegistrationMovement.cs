// Purpose: represents registration movement business state and rules.
// Main members: Id, RegistrationId, EventId, Kind, Amount, Currency, Precision, and related workflow details.

namespace ParishLife.Api.Models;

public class RegistrationMovement
{
    public string Id { get; set; } = string.Empty;

    public string RegistrationId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int Precision { get; set; }

    public string EvidenceReference { get; set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string RecordedBy { get; set; } = string.Empty;

    public string? ApprovedBy { get; set; }

    public string? RefundRequestId { get; set; } = null;

    // Cash, BankTransfer, MoneyTransfer, Cheque or Other, as recorded by the cashier; it records a payment, it does not take one.
    public string Method { get; set; } = "Cash";
}
