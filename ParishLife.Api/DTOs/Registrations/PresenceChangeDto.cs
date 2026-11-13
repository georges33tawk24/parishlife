// Purpose: returns one recorded arrival, checkout or reentry at an event door.
// Main members: Id, RegistrationId, Action, OccurredAt, RecordedAt, RecordedBy, CollectorId, VerificationEvidence, PaperReason and PickupCodeChecked.

namespace ParishLife.Api.DTOs.Registrations;

public class PresenceChangeDto
{
    public string Id { get; set; } = string.Empty;

    public string RegistrationId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string RecordedBy { get; set; } = string.Empty;

    public string? CollectorId { get; set; } = null;

    public string? VerificationEvidence { get; set; } = null;

    public string? PaperReason { get; set; } = null;

    public bool PickupCodeChecked { get; set; }
}
