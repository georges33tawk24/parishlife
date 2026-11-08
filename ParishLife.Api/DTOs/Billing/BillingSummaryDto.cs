// Purpose: represents billing summary input/output data.
// Main members: Invoice, Receipts, ActivationStatus.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Billing;

public class BillingSummaryDto
{
    public Versioned<InvoiceDto> Invoice { get; set; } = new();

    public IReadOnlyList<CashReceiptDto> Receipts { get; set; } = Array.Empty<CashReceiptDto>();

    public string ActivationStatus { get; set; } = string.Empty;
}
