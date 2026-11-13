// Purpose: stores a parish-owned person separately from the global login account.
// Main members: Id, ParishId, GivenName/FamilyName with optional Arabic twins (GivenNameAr, FamilyNameAr), BirthDate, Contact,
// Rite and RegisterStatus (office-recorded labels with no eligibility effect), CreatedBy/CreatedAt, UpdatedBy/UpdatedAt and Archived.

namespace ParishLife.Api.Models;

public class Person
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    // Arabic spelling as typed; never translated or transliterated from the Latin name. Older records hold null.
    public string? GivenNameAr { get; set; } = null;

    public string? FamilyNameAr { get; set; } = null;

    public DateOnly? BirthDate { get; set; }

    public string? Contact { get; set; }

    // The person's rite as the office records it; free text because the list of rites is an open owner decision.
    public string? Rite { get; set; } = null;

    // Member or Visitor as recorded by the office, or null when not recorded. It is a label only: it grants no account
    // membership, eligibility or access (what each value means for eligibility is an open owner decision).
    public string? RegisterStatus { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? UpdatedBy { get; set; } = null;

    public DateTimeOffset? UpdatedAt { get; set; } = null;

    public bool Archived { get; set; } = false;
}
