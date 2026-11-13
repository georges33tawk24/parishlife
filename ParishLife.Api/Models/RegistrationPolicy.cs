// Purpose: represents registration policy business state and rules.
// Main members: Id, ParishId, EventId, FormVersionId, Status, Capacity, TransportCapacity, fee terms, ClosesAt (submission deadline),
// Discounts, Instalments, PaymentMethods, MusterPoint/MusterPointAr and the last terms edit (UpdatedAt/UpdatedBy).

namespace ParishLife.Api.Models;

public class RegistrationPolicy
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string FormVersionId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int TransportCapacity { get; set; }

    public decimal Fee { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int Precision { get; set; }

    public bool WaitlistAllowed { get; set; }

    public int? MinimumAge { get; set; }

    public int? MaximumAge { get; set; }

    public int ChildAgeThreshold { get; set; }

    public bool ConsentRequired { get; set; }

    public string ConsentText { get; set; } = string.Empty;

    public string[] DoorAccountIds { get; set; } = Array.Empty<string>();

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    // Null means no deadline: submissions are accepted until the event starts.
    public DateTimeOffset? ClosesAt { get; set; } = null;

    public RegistrationDiscount[] Discounts { get; set; } = Array.Empty<RegistrationDiscount>();

    public RegistrationInstalment[] Instalments { get; set; } = Array.Empty<RegistrationInstalment>();

    // Empty means the policy predates payment methods: only Cash is accepted, as before.
    public string[] PaymentMethods { get; set; } = Array.Empty<string>();

    public string? MusterPoint { get; set; } = null;

    public string? MusterPointAr { get; set; } = null;

    public DateTimeOffset? UpdatedAt { get; set; } = null;

    public string? UpdatedBy { get; set; } = null;
}
