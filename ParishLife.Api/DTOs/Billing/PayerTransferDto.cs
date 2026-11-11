// Purpose: the two parties' view of one payer transfer; Status shows Expired once a pending proposal passed its AcceptBy instant.
// Main members: identity, direction, accounts, dates, Status, proposer and approvals, decision; From maps the stored model.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Billing;

public class PayerTransferDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string Direction { get; set; } = string.Empty;

    public string FromAccountId { get; set; } = string.Empty;

    public string ToAccountId { get; set; } = string.Empty;

    public DateTimeOffset EffectiveFrom { get; set; }

    public DateTimeOffset AcceptBy { get; set; }

    public string Status { get; set; } = string.Empty;

    public string ProposedSide { get; set; } = string.Empty;

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string? ParishApprovedBy { get; set; }

    public string? ArchdioceseApprovedBy { get; set; }

    public string? DecidedBy { get; set; }

    public DateTimeOffset? DecidedAt { get; set; }

    public string? DecisionReason { get; set; }

    public static PayerTransferDto From(PayerTransfer value, DateTimeOffset now) => new()
    {
        Id = value.Id, ParishId = value.ParishId, ArchdioceseId = value.ArchdioceseId, Direction = value.Direction,
        FromAccountId = value.FromAccountId, ToAccountId = value.ToAccountId, EffectiveFrom = value.EffectiveFrom, AcceptBy = value.AcceptBy,
        Status = value.Status.StartsWith("Awaiting", StringComparison.Ordinal) && value.AcceptBy <= now ? "Expired" : value.Status,
        ProposedSide = value.ProposedSide, ProposedBy = value.ProposedBy, ProposedAt = value.ProposedAt, Reason = value.Reason,
        ParishApprovedBy = value.ParishApprovedBy, ArchdioceseApprovedBy = value.ArchdioceseApprovedBy,
        DecidedBy = value.DecidedBy, DecidedAt = value.DecidedAt, DecisionReason = value.DecisionReason
    };
}
