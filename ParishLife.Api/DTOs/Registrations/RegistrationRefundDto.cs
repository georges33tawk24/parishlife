// Purpose: returns one event refund request and its independent decision/recording state.
// Main members: Id, RegistrationId, Amount, Currency, Status, Reason, requester, approver and recorder.

namespace ParishLife.Api.DTOs.Registrations;

public class RegistrationRefundDto
{
    public string Id { get; set; } = string.Empty;

    public string RegistrationId { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string RequestedBy { get; set; } = string.Empty;

    public DateTimeOffset RequestedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public string? RecordedBy { get; set; } = null;
}
