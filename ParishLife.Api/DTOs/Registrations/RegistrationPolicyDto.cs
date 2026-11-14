// Purpose: returns an event registration policy, its current form version and its capacity, fee, age and consent settings to authorized registration staff.
// Main members: Id, EventId, FormVersionId, Status, capacities, fee/currency/precision, waitlist, age and consent settings, door operators, creation facts,
// ClosesAt, Discounts, Instalments, PaymentMethods (empty means Cash only), MusterPoint/MusterPointAr and the last terms edit.

namespace ParishLife.Api.DTOs.Registrations;

public class RegistrationPolicyDto
{
    public string Id { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string FormVersionId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int TransportCapacity { get; set; }

    public decimal Fee { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int Precision { get; set; }

    public bool WaitlistAllowed { get; set; }

    public int? MinimumAge { get; set; } = null;

    public int? MaximumAge { get; set; } = null;

    public int ChildAgeThreshold { get; set; }

    public bool ConsentRequired { get; set; }

    public string ConsentText { get; set; } = string.Empty;

    public string[] DoorAccountIds { get; set; } = Array.Empty<string>();

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset? ClosesAt { get; set; } = null;

    public ParishLife.Api.Models.RegistrationDiscount[] Discounts { get; set; } = Array.Empty<ParishLife.Api.Models.RegistrationDiscount>();

    public ParishLife.Api.Models.RegistrationInstalment[] Instalments { get; set; } = Array.Empty<ParishLife.Api.Models.RegistrationInstalment>();

    public string[] PaymentMethods { get; set; } = Array.Empty<string>();

    public string? MusterPoint { get; set; } = null;

    public string? MusterPointAr { get; set; } = null;

    public DateTimeOffset? UpdatedAt { get; set; } = null;

    public string? UpdatedBy { get; set; } = null;
}
