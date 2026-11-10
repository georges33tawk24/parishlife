// Purpose: the terms snapshot for one external reservation (fee, deposit, currency, cancellation rules), its approval and renter acceptance,
// and the actual payments, refunds and waivers recorded against it. Later rate changes never alter it.
// Main members: ReservationId, ParishId, RenterId, Fee, Deposit, Currency, Terms, Status, ProposedBy, ApprovedBy, AcceptanceReference and Payments.

namespace ParishLife.Api.Models;

public class RentalAgreement
{
    public string ReservationId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string RenterId { get; set; } = string.Empty;

    public decimal Fee { get; set; }

    public decimal Deposit { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Terms { get; set; } = string.Empty;

    // Proposed, Approved or Accepted.
    public string Status { get; set; } = "Proposed";

    public string ProposedBy { get; set; } = string.Empty;

    public string? ApprovedBy { get; set; }

    public string? AcceptanceReference { get; set; }

    public List<RentalPayment> Payments { get; set; } = new();
}
