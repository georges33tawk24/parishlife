// Purpose: records an owner-requested, independently reviewed lost-authenticator reset in one account partition.
// Main members: Id, AccountId, SecurityStampAtRequest, Reason, CreatedAt, ExpiresAt, Status and related state.

namespace ParishLife.Api.Models;

public class MfaRecoveryRequest
{

    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string SecurityStampAtRequest { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public string Status { get; set; } = "Pending";

    public string? ReviewedBy { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    public string? ReviewReason { get; set; }

    public string? VerificationReference { get; set; }

    public DateTimeOffset? ApprovalExpiresAt { get; set; }

    public string? BoundEnrollmentId { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }
}
