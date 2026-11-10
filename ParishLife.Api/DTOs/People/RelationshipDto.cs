// Purpose: returns one relationship from a person's point of view.
// Main members: Id, PersonId, RelatedPersonId, RelatedName, Kind, Source, EvidenceReference, Status, CreatedBy, CreatedAt, EndedAt and EndReason.

namespace ParishLife.Api.DTOs.People;

public class RelationshipDto
{
    public string Id { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string RelatedPersonId { get; set; } = string.Empty;

    public string RelatedName { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string? Source { get; set; } = null;

    public string? EvidenceReference { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? EndedAt { get; set; } = null;

    public string? EndReason { get; set; } = null;
}
