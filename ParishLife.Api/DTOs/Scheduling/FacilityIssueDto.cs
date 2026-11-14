// Purpose: returns one facility issue with its triage and resolution facts.
// Main members: Id, ResourceId, ResourceKind, Description, DescriptionAr, Urgency, Evidence, Status, actors, notes, resolution evidence and cost note.

namespace ParishLife.Api.DTOs.Scheduling;

public class FacilityIssueDto
{
    public string Id { get; set; } = string.Empty;

    public string ResourceId { get; set; } = string.Empty;

    public string ResourceKind { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? DescriptionAr { get; set; } = null;

    public string Urgency { get; set; } = string.Empty;

    public string? Evidence { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public string ReportedBy { get; set; } = string.Empty;

    public DateTimeOffset ReportedAt { get; set; }

    public string? TriagedBy { get; set; } = null;

    public string? AssignedTo { get; set; } = null;

    public string? TriageNote { get; set; } = null;

    public string? ResolvedBy { get; set; } = null;

    public DateTimeOffset? ResolvedAt { get; set; } = null;

    public string? ResolutionEvidence { get; set; } = null;

    public string? CostNote { get; set; } = null;
}
