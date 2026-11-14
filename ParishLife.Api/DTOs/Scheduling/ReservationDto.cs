// Purpose: returns the actual reservation state and attempt without reporting queued allocation as confirmation.
// Main members: Id, ParishId, ResourceId, EventId, RequestedBy, StartsAt, EndsAt event title, purpose, attendance, contact, notes, checklist and decision history (all hidden when redacted).

namespace ParishLife.Api.DTOs.Scheduling;

public class ReservationDto
{
    public string? LastActionReason { get; set; }

    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ResourceId { get; set; } = string.Empty;

    public string? EventId { get; set; }

    public string? RequestedBy { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public string[] AllocationResourceIds { get; set; } = Array.Empty<string>();

    public string? CustomerId { get; set; }

    public string? TermsSnapshot { get; set; }

    public string? CurrentWorkId { get; set; }

    public string? ErrorCode { get; set; }

    public bool Redacted { get; set; }

    public string? EventTitle { get; set; } = null;

    public string? MinistryId { get; set; } = null;

    public string? Purpose { get; set; } = null;

    public string? PurposeAr { get; set; } = null;

    public int? ExpectedAttendance { get; set; } = null;

    public string? ContactPhone { get; set; } = null;

    public string? Notes { get; set; } = null;

    public ReservationChecklistItemDto[] Checklist { get; set; } = Array.Empty<ReservationChecklistItemDto>();

    public ReservationDecisionDto[] Decisions { get; set; } = Array.Empty<ReservationDecisionDto>();
}
