// Purpose: returns the authorized factual jurisdiction decision summary.
// Main members: Id, ParishId, ArchdioceseId, Status, Reason, ProposedBy, ProposedAt and related workflow state.

namespace ParishLife.Api.DTOs.Organizations;

public class ParishJurisdictionProposalDto
{

    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string? DecidedBy { get; set; }

    public DateTimeOffset? DecidedAt { get; set; }

    public string? DecisionReason { get; set; }

    public string? EvidenceReference { get; set; }
}
