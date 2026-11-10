// Purpose: optional, purpose-limited medical/allergy declarations for a person, protected at rest and readable only by designated staff.
// Main members: PersonId, ParishId, ProtectedContent, Source, Purpose, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.Models;

public class PersonMedical
{
    public string PersonId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ProtectedContent { get; set; } = string.Empty;

    // Who supplied it (for example "Guardian form, 2026-11-10"); without a source the declaration is shown as unverified.
    public string? Source { get; set; }

    public string Purpose { get; set; } = string.Empty;

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
