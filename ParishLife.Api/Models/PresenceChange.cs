// Purpose: represents presence change business state and rules.
// Main members: Id, RegistrationId, EventId, Action, OccurredAt, RecordedAt, RecordedBy, collector checks and PickupCodeChecked.

namespace ParishLife.Api.Models;

public class PresenceChange
{
    public string Id { get; set; } = string.Empty;

    public string RegistrationId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string RecordedBy { get; set; } = string.Empty;

    public string? CollectorId { get; set; }

    public string? VerificationEvidence { get; set; }

    public string? PaperReason { get; set; }

    // True when a checkout matched the registration's issued pickup code; the code itself is never stored.
    public bool PickupCodeChecked { get; set; }
}
