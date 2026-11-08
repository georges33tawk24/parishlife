// Purpose: represents cash receipt business state and rules.
// Main members: Id, InvoiceId, ParishId, Received, ReceivedAt, PayerName, CollectedBy, and related workflow details.

namespace ParishLife.Api.Models;

public class CashReceipt
{
    public string Id { get; set; } = string.Empty;

    public string InvoiceId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public Money Received { get; set; } = new();

    public DateTimeOffset ReceivedAt { get; set; }

    public string PayerName { get; set; } = string.Empty;

    public string CollectedBy { get; set; } = string.Empty;

    public string ReceiptReference { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
