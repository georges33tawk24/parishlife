// Purpose: returns a request case; applicant projections omit triage, internal and authority-review details.
// Main members: Id, Reference, Kind, Summary, Details, PreferredDates, Origin, requester/subject/relationship facts, Status, StatusMeaning, decision facts, explanation, triage, checklist, links and dates.

using ParishLife.Api.Models;
using ParishLife.Api.DTOs.Communications;

namespace ParishLife.Api.DTOs.Requests;

public class ParishRequestDto
{
    public string Id { get; set; } = string.Empty;

    // Loaded on single-record reads and notifying commands; list/history projections leave it unloaded.
    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;

    public string Reference { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public Dictionary<string, string> Details { get; set; } = new();

    public string? PreferredDates { get; set; } = null;

    public string Origin { get; set; } = string.Empty;

    public string? ApplicantAccountId { get; set; }

    public string? ClaimantAccountId { get; set; } = null;

    public string? RequesterName { get; set; } = null;

    public string? RequesterContact { get; set; } = null;

    public string? SubjectPersonId { get; set; } = null;

    public string? SubjectDescription { get; set; } = null;

    public string Relationship { get; set; } = string.Empty;

    public string? AuthorityBasis { get; set; } = null;

    public bool AuthorityReviewed { get; set; }

    public string Status { get; set; } = string.Empty;

    public string StatusMeaning { get; set; } = string.Empty;

    public DateTimeOffset? AcceptedAt { get; set; } = null;

    public DateTimeOffset? ClergyApprovedAt { get; set; } = null;

    public DateTimeOffset? ConfirmedDate { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? ApplicantExplanation { get; set; } = null;

    public string? Urgency { get; set; } = null;

    public string? UrgencyReason { get; set; } = null;

    public string? AssignedTo { get; set; } = null;

    public DateTimeOffset? Deadline { get; set; } = null;

    public string? NextAction { get; set; } = null;

    public bool Overdue { get; set; }

    public ChecklistItemDto[] Checklist { get; set; } = Array.Empty<ChecklistItemDto>();

    public RequestLink[] Links { get; set; } = Array.Empty<RequestLink>();

    public string? CreatedBy { get; set; } = null;

    public DateTimeOffset ReceivedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
