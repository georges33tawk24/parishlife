// Purpose: returns the explicit authorized Coverage response fields without binding the persistence model.
// Main members: response properties; From maps the allowed fields and copies exposed collections.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Billing;

public class CoverageDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string InvoiceId { get; set; } = string.Empty;

    public string PlanId { get; set; } = string.Empty;

    public string[] Modules { get; set; } = Array.Empty<string>();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string BillingAccountId { get; set; } = string.Empty;

    public static CoverageDto From(Coverage value)
    {
        return new CoverageDto
        {
            Id = value.Id,
            ParishId = value.ParishId,
            InvoiceId = value.InvoiceId,
            PlanId = value.PlanId,
            Modules = [.. value.Modules],
            StartsAt = value.StartsAt,
            EndsAt = value.EndsAt,
            BillingAccountId = value.BillingAccountId
        };
    }
}
