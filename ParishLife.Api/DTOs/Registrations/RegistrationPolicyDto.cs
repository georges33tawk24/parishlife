// Purpose: returns an event registration policy, its current form version and its capacity, fee, age and consent settings to authorized registration staff.
// Main members: Id, EventId, FormVersionId, Status, capacities, fee/currency/precision, waitlist, age and consent settings, door operators and creation facts.

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
}
