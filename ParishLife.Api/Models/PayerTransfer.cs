// Purpose: a proposed change of who pays for a parish's FUTURE subscription coverage, between the parish itself and a registered archdiocese.
// It needs the parish owner's and the archdiocese representative's approval of the exact version; it never moves paid periods, invoices,
// receipts, data, users or access grants, and it records no payment.
// Main members: Id, ParishId, ArchdioceseId, Direction, From/To billing accounts, EffectiveFrom, AcceptBy, Status, approvals and decision.

namespace ParishLife.Api.Models;

public class PayerTransfer
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
}
