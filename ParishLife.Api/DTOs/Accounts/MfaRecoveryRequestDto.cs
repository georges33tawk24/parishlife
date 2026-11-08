// Purpose: returns authorized recovery review status while keeping private verification references operator-only.
// Main members: Id, AccountId, Status, Reason, CreatedAt, ExpiresAt, ReviewedBy and related state.

namespace ParishLife.Api.DTOs.Accounts;

public class MfaRecoveryRequestDto
{

    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public string? ReviewedBy { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    public string? ReviewReason { get; set; }

    public DateTimeOffset? ApprovalExpiresAt { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }

    public string? VerificationReference { get; set; }
}
