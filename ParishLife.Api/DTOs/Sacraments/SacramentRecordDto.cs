// Purpose: returns a sacramental case with original facts, current (amended) facts, official registration, review, requirements, amendments
// and timeline. Records saved before a field existed return null (or an empty list) for it.
// Main members: Id, Sacrament, SubjectPersonId, RequestId, Facts, CurrentFacts, Status, dates, celebrant and celebration facts with Arabic twins,
// OfficialNumber, BookReference, RegisterPage, office review, Requirements, RequestAmendments, Amendments, Timeline, CreatedBy and CreatedAt.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Sacraments;

public class SacramentRecordDto
{
    public string Id { get; set; } = string.Empty;

    public string Sacrament { get; set; } = string.Empty;

    public string SubjectPersonId { get; set; } = string.Empty;

    public string? RequestId { get; set; } = null;

    public Dictionary<string, string> Facts { get; set; } = new();

    // Facts with approved amendments applied; the originals stay in Facts.
    public Dictionary<string, string> CurrentFacts { get; set; } = new();

    public string Status { get; set; } = string.Empty;

    public string? TentativeDate { get; set; } = null;

    public DateTimeOffset? ScheduledAt { get; set; } = null;

    public string? CelebrantAccountId { get; set; } = null;

    public string? CelebrantPersonId { get; set; } = null;

    public string? CelebrantName { get; set; } = null;

    public string? CelebrantNameAr { get; set; } = null;

    public DateTimeOffset? CelebratedAt { get; set; } = null;

    public string? Place { get; set; } = null;

    public string? PlaceAr { get; set; } = null;

    public string? Witnesses { get; set; } = null;

    public string? WitnessesAr { get; set; } = null;

    public string? ReturnReason { get; set; } = null;

    public string? OfficialNumber { get; set; } = null;

    public string? BookReference { get; set; } = null;

    public string? RegisterPage { get; set; } = null;

    public string? RegisteredBy { get; set; } = null;

    public DateTimeOffset? RegisteredAt { get; set; } = null;

    public string? OfficeReviewedBy { get; set; } = null;

    public DateTimeOffset? OfficeReviewedAt { get; set; } = null;

    public string? OfficeReviewNote { get; set; } = null;

    public SacramentRequirementState[] Requirements { get; set; } = Array.Empty<SacramentRequirementState>();

    public bool RequirementsBlockScheduling { get; set; }

    public SacramentRequestAmendment[] RequestAmendments { get; set; } = Array.Empty<SacramentRequestAmendment>();

    public SacramentAmendment[] Amendments { get; set; } = Array.Empty<SacramentAmendment>();

    public SacramentStep[] Timeline { get; set; } = Array.Empty<SacramentStep>();

    public string CreatedBy { get; set; } = string.Empty;

    // When the request was opened.
    public DateTimeOffset CreatedAt { get; set; }
}
