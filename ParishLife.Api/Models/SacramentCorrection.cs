// Purpose: represents a proposed correction to a registered sacramental entry awaiting a priest decision.
// Main members: Id, ParishId, RecordId, Field, NewValue, Reason, Evidence, Status, proposal and decision facts.

namespace ParishLife.Api.Models;

public class SacramentCorrection
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string RecordId { get; set; } = string.Empty;

    public string Field { get; set; } = string.Empty;

    public string NewValue { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string Evidence { get; set; } = string.Empty;

    // Pending, Approved or Rejected.
    public string Status { get; set; } = "Pending";

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public string? DecisionNote { get; set; } = null;
}
