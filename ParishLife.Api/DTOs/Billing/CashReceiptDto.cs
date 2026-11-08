// Purpose: returns the explicit authorized CashReceipt response fields without binding the persistence model.
// Main members: response properties; From maps the allowed fields and copies exposed collections.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Billing;

public class CashReceiptDto
{
    public string Id { get; set; } = string.Empty;

    public string InvoiceId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public MoneyDto Received { get; set; } = new();

    public DateTimeOffset ReceivedAt { get; set; }

    public string PayerName { get; set; } = string.Empty;

    public string CollectedBy { get; set; } = string.Empty;

    public string ReceiptReference { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public static CashReceiptDto From(CashReceipt value)
    {
        return new CashReceiptDto
        {
            Id = value.Id,
            InvoiceId = value.InvoiceId,
            ParishId = value.ParishId,
            Received = MoneyDto.From(value.Received),
            ReceivedAt = value.ReceivedAt,
            PayerName = value.PayerName,
            CollectedBy = value.CollectedBy,
            ReceiptReference = value.ReceiptReference,
            RecordedBy = value.RecordedBy,
            RecordedAt = value.RecordedAt
        };
    }
}
