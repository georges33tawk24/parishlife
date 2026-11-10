// Purpose: an external renter (person or organization) kept separate from parish membership, visible only to facilities/finance staff.
// Main members: Id, ParishId, Name, Organization, ResponsibleContact, VerificationReference, CreatedBy and CreatedAt.

namespace ParishLife.Api.Models;

public class Renter
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Organization { get; set; }

    public string ResponsibleContact { get; set; } = string.Empty;

    public string? VerificationReference { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
