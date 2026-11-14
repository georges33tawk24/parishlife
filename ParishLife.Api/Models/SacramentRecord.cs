// Purpose: represents one person's sacramental case from priest acceptance through actual celebration to official registration.
// Main members: Id, ParishId, Kind (sacrament), PersonId, RequestId, Facts, Status, dates, celebrant (account, parish person, name and Arabic
// name), celebration facts with Arabic twins, official number, book and page, office review, preparation requirements, request amendments,
// registered-entry amendments and timeline.

namespace ParishLife.Api.Models;

public class SacramentRecord
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // The sacrament (Baptism, FirstCommunion, Confirmation, Marriage, Funeral, Anointing or Other); named Kind to use the reviewed index path.
    public string Kind { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string? RequestId { get; set; } = null;

    // Rite-specific facts as supplied; approved field templates are a clergy input.
    public Dictionary<string, string> Facts { get; set; } = new();

    // Received, Preparation, Scheduled, Celebrated, Registered, Declined or Cancelled.
    public string Status { get; set; } = "Received";

    public string? TentativeDate { get; set; } = null;

    public DateTimeOffset? ScheduledAt { get; set; } = null;

    public string? CelebrantAccountId { get; set; } = null;

    public string? CelebrantName { get; set; } = null;

    public string? CelebrantNameAr { get; set; } = null;

    // A parish person record for the celebrant, when the office links one; the name texts stay as recorded.
    public string? CelebrantPersonId { get; set; } = null;

    public DateTimeOffset? CelebratedAt { get; set; } = null;

    public string? Place { get; set; } = null;

    public string? PlaceAr { get; set; } = null;

    public string? Witnesses { get; set; } = null;

    public string? WitnessesAr { get; set; } = null;

    public string? ReturnReason { get; set; } = null;

    public string? OfficialNumber { get; set; } = null;

    // The register book; entries made before the page field existed may hold book and page together here.
    public string? BookReference { get; set; } = null;

    public string? RegisterPage { get; set; } = null;

    public string? RegisteredBy { get; set; } = null;

    public DateTimeOffset? RegisteredAt { get; set; } = null;

    // The office's review of a received request; it informs the priest and gates nothing.
    public string? OfficeReviewedBy { get; set; } = null;

    public DateTimeOffset? OfficeReviewedAt { get; set; } = null;

    public string? OfficeReviewNote { get; set; } = null;

    // Copied from the parish list when the case is accepted (or synchronized later); empty when the parish has none.
    public SacramentRequirementState[] Requirements { get; set; } = Array.Empty<SacramentRequirementState>();

    public bool RequirementsBlockScheduling { get; set; }

    public SacramentRequestAmendment[] RequestAmendments { get; set; } = Array.Empty<SacramentRequestAmendment>();

    public SacramentAmendment[] Amendments { get; set; } = Array.Empty<SacramentAmendment>();

    public SacramentStep[] Timeline { get; set; } = Array.Empty<SacramentStep>();

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
