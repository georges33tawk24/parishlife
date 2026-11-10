// Purpose: represents one request/loan of a ministry stock item to a parish person, through issue, return and condition check.
// Main members: Id, ParishId, MinistryId, StockId, PersonId, Quantity, Status, Purpose, dates, actors, condition facts and follow-up.

namespace ParishLife.Api.Models;

public class MinistryLoan
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string StockId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public int Quantity { get; set; }

    // Requested, Approved, Declined, Cancelled, Issued, Returned, ConditionChecked or Closed.
    public string Status { get; set; } = "Requested";

    public string? Purpose { get; set; } = null;

    public string RequestedBy { get; set; } = string.Empty;

    public DateTimeOffset RequestedAt { get; set; }

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? IssuedAt { get; set; } = null;

    public string? IssuedBy { get; set; } = null;

    public DateTimeOffset? DueAt { get; set; } = null;

    public string? IssueCondition { get; set; } = null;

    public DateTimeOffset? ReturnedAt { get; set; } = null;

    public string? ReturnedTo { get; set; } = null;

    public string? ReturnCondition { get; set; } = null;

    // Good, Damaged or Missing after the condition check.
    public string? Outcome { get; set; } = null;

    public string? ConditionEvidence { get; set; } = null;

    // Damaged or missing items need an explicit follow-up; no charge or deletion is implied.
    public bool FollowUpRequired { get; set; }

    public string? FollowUpResolution { get; set; } = null;

    public string? Reason { get; set; } = null;
}
