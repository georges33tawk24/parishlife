// Purpose: represents registration refund business state and rules.
// Main members: Id, RegistrationId, Amount, Currency, Status, Reason, RequestedBy, and related workflow details.

namespace ParishLife.Api.Models;

public class RegistrationRefund
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
