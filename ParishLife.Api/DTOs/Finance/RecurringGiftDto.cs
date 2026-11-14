// Purpose: returns a recurring gift with the next date a gift is expected; an expected date is not a charge, a debt or proof of payment.
// Main members: Id, Version, PersonId, HouseholdId, FundId, Amount, Currency, Frequency, Method, StartsOn, EndsOn, NextExpectedOn, Note,
// Status, Reason, CreatedBy, UpdatedBy and Notice.

namespace ParishLife.Api.DTOs.Finance;

public class RecurringGiftDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Frequency { get; set; } = string.Empty;

    public string Method { get; set; } = string.Empty;

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    // Null when the gift is paused or ended, or its schedule has finished.
    public DateOnly? NextExpectedOn { get; set; } = null;

    public string? Note { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public string? Reason { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public string UpdatedBy { get; set; } = string.Empty;

    public string Notice { get; set; } = "A recorded intention only; ParishLife never charges anyone, and a gift counts only once it is received and posted.";
}
