// Purpose: returns one actual event money movement (cash received or refunded).
// Main members: Id, RegistrationId, Kind, Amount, Currency, EvidenceReference, OccurredAt, RecordedAt, RecordedBy, ApprovedBy and RefundRequestId.

namespace ParishLife.Api.DTOs.Registrations;

public class RegistrationMovementDto
{
    public string Id { get; set; } = string.Empty;

    public string RegistrationId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string EvidenceReference { get; set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string RecordedBy { get; set; } = string.Empty;

    public string? ApprovedBy { get; set; } = null;

    public string? RefundRequestId { get; set; } = null;
}
