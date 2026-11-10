// Purpose: represents an independent concern reviewer appointed by the bishop for an archdiocese, with category and identity capabilities.
// Main members: Id, ArchdioceseId, AccountId, Description, Categories, CanViewIdentity, Active, appointment and ending facts.

namespace ParishLife.Api.Models;

public class ConcernReviewer
{
    // Opaque id shown to submitters instead of the reviewer's account.
    public string Id { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string[] Categories { get; set; } = Array.Empty<string>();

    public bool CanViewIdentity { get; set; }

    public bool Active { get; set; }

    public string AppointedBy { get; set; } = string.Empty;

    public DateTimeOffset AppointedAt { get; set; }

    public string EvidenceReference { get; set; } = string.Empty;

    public DateTimeOffset? EndedAt { get; set; } = null;
}
