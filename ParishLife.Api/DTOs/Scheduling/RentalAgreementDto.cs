// Purpose: shows a rental agreement with separate deposit and balance states derived only from recorded payments.
// Main members: ReservationId, Version, RenterId, Fee, Deposit, Currency, Terms, Status, ApprovedBy, AcceptanceReference, DepositState,
// DepositHeld, FeeOutstanding and Payments.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Scheduling;

public class RentalAgreementDto
{
    public string ReservationId { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string RenterId { get; set; } = string.Empty;

    public decimal Fee { get; set; }

    public decimal Deposit { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Terms { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? ApprovedBy { get; set; }

    public string? AcceptanceReference { get; set; }

    public string DepositState { get; set; } = string.Empty;

    public decimal DepositHeld { get; set; }

    public decimal FeeOutstanding { get; set; }

    public RentalPayment[] Payments { get; set; } = Array.Empty<RentalPayment>();
}
