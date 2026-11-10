// Purpose: returns the current applicant-visible form and supplied event terms to a member with a reviewed person link.
// Main members: EventId, FormVersionId, Fields, fee/currency/precision, age range and consent wording; staff assignments are excluded.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Registrations;

public class RegistrationApplicantFormDto
{
    public string EventId { get; set; } = string.Empty;

    public string FormVersionId { get; set; } = string.Empty;

    public RegistrationField[] Fields { get; set; } = Array.Empty<RegistrationField>();

    public decimal Fee { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int Precision { get; set; }

    public int? MinimumAge { get; set; } = null;

    public int? MaximumAge { get; set; } = null;

    public bool ConsentRequired { get; set; }

    public string ConsentText { get; set; } = string.Empty;
}
