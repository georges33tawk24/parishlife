// Purpose: returns an authorized first-bishop appointment summary with current effective/review status.
// Main members: scope, nominee, dates, status and decision actors; From exposes evidence references only for an authorized operator.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Organizations;

public class BishopAppointmentDto
{
    public string Id { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public DateTimeOffset AcceptBy { get; set; }

    public DateTimeOffset? ReviewDueAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public bool Effective { get; set; }

    public bool ReviewOverdue { get; set; }

    public string ProposedBy { get; set; } = string.Empty;

    public string? ReviewedBy { get; set; }

    public DateTimeOffset? RespondedAt { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string? ReviewReason { get; set; }

    public string? ResponseReason { get; set; }

    public string? EvidenceReference { get; set; }

    public static BishopAppointmentDto From(BishopAppointment value, DateTimeOffset now, bool includeEvidence = false)
    {
        return new BishopAppointmentDto
        {
            Id = value.Id,
            ArchdioceseId = value.ArchdioceseId,
            AccountId = value.AccountId,
            StartsAt = value.StartsAt,
            EndsAt = value.EndsAt,
            AcceptBy = value.AcceptBy,
            ReviewDueAt = value.ReviewDueAt,
            Status = value.Status,
            Effective = value.IsEffective(now),
            ReviewOverdue = value.IsEffective(now) && value.ReviewDueAt <= now,
            ProposedBy = value.ProposedBy,
            ReviewedBy = value.ReviewedBy,
            RespondedAt = value.RespondedAt,
            Reason = value.Reason,
            ReviewReason = value.ReviewReason,
            ResponseReason = value.ResponseReason,
            EvidenceReference = includeEvidence ? value.EvidenceReference : null
        };
    }
}
