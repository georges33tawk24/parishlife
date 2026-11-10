// Purpose: shows a medical/allergy declaration to designated staff, labelled unverified when it has no source.
// Main members: PersonId, Allergies, Conditions, BloodType, Notes, Source, Verified, Purpose, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.DTOs.People;

public class MedicalDto
{
    public string PersonId { get; set; } = string.Empty;

    public string? Allergies { get; set; }

    public string? Conditions { get; set; }

    public string? BloodType { get; set; }

    public string? Notes { get; set; }

    public string? Source { get; set; }

    public bool Verified { get; set; }

    public string Purpose { get; set; } = string.Empty;

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
