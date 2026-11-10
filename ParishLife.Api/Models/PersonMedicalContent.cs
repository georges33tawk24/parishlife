// Purpose: the medical declaration fields serialized and protected together inside PersonMedical.ProtectedContent.
// Main members: Allergies, Conditions, BloodType and Notes.

namespace ParishLife.Api.Models;

public class PersonMedicalContent
{
    public string? Allergies { get; set; }

    public string? Conditions { get; set; }

    public string? BloodType { get; set; }

    public string? Notes { get; set; }
}
