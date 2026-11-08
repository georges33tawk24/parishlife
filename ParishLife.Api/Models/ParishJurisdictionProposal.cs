// Purpose: records the parish representative factual jurisdiction proposal and the named bishop decision.
// Main members: Id, ParishId, ArchdioceseId, ProposedBy, ProposedAt, EvidenceReference, Reason and related workflow state.

namespace ParishLife.Api.Models;

public class ParishJurisdictionProposal
{

    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string EvidenceReference { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending";

    public string? DecidedBy { get; set; }

    public DateTimeOffset? DecidedAt { get; set; }

    public string? DecisionReason { get; set; }
}
