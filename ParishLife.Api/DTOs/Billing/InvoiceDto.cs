// Purpose: returns the explicit authorized Invoice response fields without binding the persistence model.
// Main members: response properties; From maps the allowed fields and copies exposed collections.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Billing;

public class InvoiceDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string BillingAccountId { get; set; } = string.Empty;

    public string PlanId { get; set; } = string.Empty;

    public string PlanName { get; set; } = string.Empty;

    public string[] Modules { get; set; } = Array.Empty<string>();

    public MoneyDto Total { get; set; } = new();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public decimal Paid { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public static InvoiceDto From(Invoice value)
    {
        return new InvoiceDto
        {
            Id = value.Id,
            ParishId = value.ParishId,
            BillingAccountId = value.BillingAccountId,
            PlanId = value.PlanId,
            PlanName = value.PlanName,
            Modules = [.. value.Modules],
            Total = MoneyDto.From(value.Total),
            StartsAt = value.StartsAt,
            EndsAt = value.EndsAt,
            Paid = value.Paid,
            CreatedBy = value.CreatedBy,
            CreatedAt = value.CreatedAt,
            Status = value.Status
        };
    }
}
