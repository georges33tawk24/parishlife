// Purpose: represents a confidential concern visible only to its submitter and its selected, eligible independent reviewers.
// Main members: Id, ParishId, ArchdioceseId, Category, Urgency, ProtectedContent, ApplicantAccountId (submitter), Anonymous, implicated and selected reviewers, assignment, Status, dates and the latest reviewer notice pointer.

namespace ParishLife.Api.Models;

public class Concern
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Urgency { get; set; } = "Normal";

    // Data Protection payload of the summary and details.
    public string ProtectedContent { get; set; } = string.Empty;

    // The submitter; reviewers see it only when the case is identified and they hold identity capability.
    public string ApplicantAccountId { get; set; } = string.Empty;

    public bool Anonymous { get; set; }

    public DateTimeOffset? IdentifiedAt { get; set; } = null;

    public string[] ImplicatedAccountIds { get; set; } = Array.Empty<string>();

    public string[] SelectedReviewerIds { get; set; } = Array.Empty<string>();

    public string? AssignedReviewerId { get; set; } = null;

    // Submitted, Accepted, NeedsInformation, UnderReview, ResponseProvided, Closed or Reopened.
    public string Status { get; set; } = "Submitted";

    public string? NextAction { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    // Internal pointer to the latest reviewer-action submitter notice (entries keep their own); never projected to the submitter.
    public List<string>? NotificationWorkIds { get; set; } = null;
}
