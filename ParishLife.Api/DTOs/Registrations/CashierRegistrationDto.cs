// Purpose: returns participant identification and balances needed to record event receipts/refund requests without registration answers or safeguarding evidence.
// Main members: Id, EventId, DisplayName, Status, Fee, Currency, Precision, Received, Refunded, Outstanding,
// the applied discount, Due (fee less discount) and DueNow (the instalment schedule due by today, never above Due).

namespace ParishLife.Api.DTOs.Registrations;

public class CashierRegistrationDto
{
    public string Id { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public decimal Fee { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int Precision { get; set; }

    public decimal Received { get; set; }

    public decimal Refunded { get; set; }

    public decimal Outstanding { get; set; }

    public string? DiscountName { get; set; } = null;

    public string? DiscountNameAr { get; set; } = null;

    public decimal DiscountAmount { get; set; }

    public decimal Due { get; set; }

    public decimal DueNow { get; set; }

    public string[] PaymentMethods { get; set; } = Array.Empty<string>();
}
