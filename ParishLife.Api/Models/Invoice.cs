// Purpose: stores the issued price snapshot and derives payment status without currency conversion.
// Main functions: Receive.

using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Models;

public class Invoice
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string BillingAccountId { get; set; } = string.Empty;

    public string PlanId { get; set; } = string.Empty;

    public string PlanName { get; set; } = string.Empty;

    public string[] Modules { get; set; } = Array.Empty<string>();

    public Money Total { get; set; } = new();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public decimal Paid { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
    public string Status => Paid == Total.Amount ? "Paid" : Paid == 0 ? "Unpaid" : "PartiallyPaid";

    public Invoice Receive(decimal amount, string currency)
    {
        _ = Money.Create(amount, currency, Total.MinorUnits);
        if (!string.Equals(currency, Total.Currency, StringComparison.Ordinal))
            throw new DomainException("currency_mismatch", "Payment currency must match the invoice; no implicit currency conversion.");
        if (Paid + amount > Total.Amount)
            throw new DomainException("overpayment", "Payment exceeds the remaining amount. Resolve the allocation before recording it.", FailureKind.Conflict);
        return new Invoice
        {
            Id = this.Id,
            ParishId = this.ParishId,
            BillingAccountId = this.BillingAccountId,
            PlanId = this.PlanId,
            PlanName = this.PlanName,
            Modules = this.Modules,
            Total = this.Total,
            StartsAt = this.StartsAt,
            EndsAt = this.EndsAt,
            Paid = Paid + amount,
            CreatedBy = this.CreatedBy,
            CreatedAt = this.CreatedAt
        };
    }
}
