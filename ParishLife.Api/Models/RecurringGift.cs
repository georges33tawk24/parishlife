// Purpose: a giver's standing intention to give a set amount on a schedule. It is a stored schedule only: it never charges anyone,
// and a gift counts only when it is actually received, counted and posted.
// Main members: Id, ParishId, PersonId, HouseholdId, FundId, Amount, Currency, Frequency, Method, StartsOn, EndsOn, Note, Status, Reason and actors.

namespace ParishLife.Api.Models;

public class RecurringGift
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    // Weekly, Monthly, Quarterly or Yearly.
    public string Frequency { get; set; } = string.Empty;

    // How the giver said they would give: Cash, Bank, Cheque, Card or Other. Nothing is collected through it.
    public string Method { get; set; } = string.Empty;

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    public string? Note { get; set; } = null;

    // Active, Paused or Ended.
    public string Status { get; set; } = "Active";

    public string? Reason { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
