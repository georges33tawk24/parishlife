// Purpose: returns a proposed register correction and its decision.
// Main members: Id, RecordId, Field, NewValue, Reason, Evidence, Status, proposal and decision facts.

namespace ParishLife.Api.DTOs.Sacraments;

public class SacramentCorrectionDto
{
    public string Id { get; set; } = string.Empty;

    public string RecordId { get; set; } = string.Empty;

    public string Field { get; set; } = string.Empty;

    public string NewValue { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string Evidence { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public string? DecisionNote { get; set; } = null;
}
