// Purpose: records an evidenced first-bishop appointment, independent review, and the nominee's acceptance.
// Main members: account/scope, effective dates, evidence, recorded actors, and review state; IsEffective checks actual authority dates.

namespace ParishLife.Api.Models;

public class BishopAppointment
{
    public string Id { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public DateTimeOffset AcceptBy { get; set; }

    public DateTimeOffset? ReviewDueAt { get; set; }

    public string EvidenceReference { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string Status { get; set; } = "PendingReview";

    public string? ReviewedBy { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    public string? ReviewReason { get; set; }

    public DateTimeOffset? RespondedAt { get; set; }

    public string? ResponseReason { get; set; }

    public bool Revoked { get; set; }

    public bool IsEffective(DateTimeOffset now) => Status == "Accepted" && !Revoked
        && StartsAt <= now && (EndsAt is null || now < EndsAt)
        && RespondedAt is not null && RespondedAt <= now && ReviewedAt is not null && ReviewedAt <= now
        && ProposedAt <= ReviewedAt && ReviewedAt <= RespondedAt && RespondedAt < AcceptBy
        && !string.IsNullOrWhiteSpace(EvidenceReference) && !string.IsNullOrWhiteSpace(ReviewedBy)
        && ProposedBy != ReviewedBy && AccountId != ProposedBy && AccountId != ReviewedBy;
}
