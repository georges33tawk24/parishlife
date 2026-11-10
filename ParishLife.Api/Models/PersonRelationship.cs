// Purpose: represents one directed person-to-person relationship; every relationship is stored with its mirror.
// Main members: Id, ParishId, PersonId, RelatedPersonId, Kind, PairId, Source, EvidenceReference, Status and change facts.

namespace ParishLife.Api.Models;

public class PersonRelationship
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string RelatedPersonId { get; set; } = string.Empty;

    // How RelatedPersonId relates to PersonId: Parent, Child, AdoptiveParent, AdoptiveChild, StepParent, StepChild, Spouse, Sibling, Guardian, Ward or Relative.
    public string Kind { get; set; } = string.Empty;

    public string PairId { get; set; } = string.Empty;

    public string? Source { get; set; } = null;

    // Required for guardian links.
    public string? EvidenceReference { get; set; } = null;

    // Active or Ended.
    public string Status { get; set; } = "Active";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? EndedAt { get; set; } = null;

    public string? EndReason { get; set; } = null;
}
