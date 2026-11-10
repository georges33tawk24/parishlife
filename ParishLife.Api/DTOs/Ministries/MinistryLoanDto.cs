// Purpose: returns one loan; custodian projections include evidence and actors, own projections omit them.
// Main members: Id, MinistryId, StockId, StockName, PersonId, Quantity, Status, Overdue, Purpose, dates, condition, follow-up and actors.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryLoanDto
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string StockId { get; set; } = string.Empty;

    public string StockName { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public string Status { get; set; } = string.Empty;

    public bool Overdue { get; set; }

    public string? Purpose { get; set; } = null;

    public DateTimeOffset RequestedAt { get; set; }

    public DateTimeOffset? IssuedAt { get; set; } = null;

    public DateTimeOffset? DueAt { get; set; } = null;

    public DateTimeOffset? ReturnedAt { get; set; } = null;

    public string? Outcome { get; set; } = null;

    public bool FollowUpRequired { get; set; }

    public string? Reason { get; set; } = null;

    public string? RequestedBy { get; set; } = null;

    public string? DecidedBy { get; set; } = null;

    public string? IssuedBy { get; set; } = null;

    public string? ReturnedTo { get; set; } = null;

    public string? ReturnCondition { get; set; } = null;

    public string? IssueCondition { get; set; } = null;

    public string? ConditionEvidence { get; set; } = null;

    public string? FollowUpResolution { get; set; } = null;
}
