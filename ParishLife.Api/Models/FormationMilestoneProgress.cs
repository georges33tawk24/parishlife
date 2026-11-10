// Purpose: represents one learner's recorded state for one milestone of a pinned formation program revision.
// Main members: Key, Status, ResumeStatus, evidence/source facts, actual AchievedOn date, recorder/reviewer/completer identities and applicant explanation.

namespace ParishLife.Api.Models;

public class FormationMilestoneProgress
{
    public string Key { get; set; } = string.Empty;

    // Enrolled, InProgress, EvidenceSubmitted, Reviewed, Completed or NeedsInformation.
    public string Status { get; set; } = "Enrolled";

    // The exact review stage a returned milestone resumes after corrected information.
    public string? ResumeStatus { get; set; } = null;

    public string? EvidenceReference { get; set; } = null;

    // Course or ExternalPriorLearning; external learning keeps its provenance and still needs review.
    public string? Source { get; set; } = null;

    public string? ExternalProvenance { get; set; } = null;

    public DateOnly? AchievedOn { get; set; } = null;

    public string? RecordedBy { get; set; } = null;

    public DateTimeOffset? RecordedAt { get; set; } = null;

    public string? ReviewedBy { get; set; } = null;

    public DateTimeOffset? ReviewedAt { get; set; } = null;

    public string? ReviewReference { get; set; } = null;

    public string? CompletedBy { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    // Applicant-visible explanation for returned information; private review references stay separate.
    public string? ApplicantExplanation { get; set; } = null;
}
