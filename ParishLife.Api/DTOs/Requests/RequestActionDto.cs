// Purpose: requests one applicant or office transition on a request case.
// Main members: OperationId, Version, Action, Explanation, InternalNote, AssignedTo, Urgency, UrgencyReason, Deadline, NextAction, SubjectPersonId, AuthorityEvidence, ConfirmedDate, Link and Details.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class RequestActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(edit|withdraw|respond|request-cancel|triage|accept|return|decline|cancel|clergy-approve|confirm-date|complete|match-subject|review-authority|link)$")]
    public string Action { get; set; } = string.Empty;

    // Applicant-visible text.
    [StringLength(2000)]
    public string? Explanation { get; set; } = null;

    [NotEmptyGuid]
    public Guid? AssignedTo { get; set; } = null;

    [RegularExpression("^(Normal|Urgent)$")]
    public string? Urgency { get; set; } = null;

    [StringLength(500)]
    public string? UrgencyReason { get; set; } = null;

    public DateTimeOffset? Deadline { get; set; } = null;

    [StringLength(500)]
    public string? NextAction { get; set; } = null;

    [NotEmptyGuid]
    public Guid? SubjectPersonId { get; set; } = null;

    [StringLength(1000)]
    public string? AuthorityEvidence { get; set; } = null;

    public DateTimeOffset? ConfirmedDate { get; set; } = null;

    [RegularExpression("^(Reservation|Event|Registration|SacramentRecord|Certificate|Other)$")]
    public string? LinkKind { get; set; } = null;

    [NotEmptyGuid]
    public Guid? LinkRecordId { get; set; } = null;

    public Dictionary<string, string>? Details { get; set; } = null;

    [StringLength(300)]
    public string? Summary { get; set; } = null;
}
