// Purpose: represents a reported facility or equipment problem through triage, repair and qualified resolution.
// Main members: Id, ParishId, ResourceId, ResourceKind, Description, DescriptionAr, Urgency, Evidence, Status, assignment, resolution and actor facts.

namespace ParishLife.Api.Models;

public class FacilityIssue
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ResourceId { get; set; } = string.Empty;

    // Facility or Equipment.
    public string ResourceKind { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? DescriptionAr { get; set; } = null;

    // Low, Normal, Urgent or Hazard.
    public string Urgency { get; set; } = "Normal";

    public string? Evidence { get; set; } = null;

    // Reported, Triaged, InRepair, Resolved or Dismissed.
    public string Status { get; set; } = "Reported";

    public string ReportedBy { get; set; } = string.Empty;

    public DateTimeOffset ReportedAt { get; set; }

    public string? TriagedBy { get; set; } = null;

    public string? AssignedTo { get; set; } = null;

    public string? TriageNote { get; set; } = null;

    public string? ResolvedBy { get; set; } = null;

    public DateTimeOffset? ResolvedAt { get; set; } = null;

    public string? ResolutionEvidence { get; set; } = null;

    // A recorded estimate or claim; it posts nothing to finance.
    public string? CostNote { get; set; } = null;
}
