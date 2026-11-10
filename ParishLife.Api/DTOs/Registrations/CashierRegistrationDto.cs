// Purpose: returns participant identification and balances needed to record event receipts/refund requests without registration answers or safeguarding evidence.
// Main members: Id, EventId, DisplayName, Status, Fee, Currency, Precision, Received, Refunded and Outstanding.

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
}
