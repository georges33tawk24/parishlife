// Purpose: returns an authorized appointment summary without exposing private credential or evidence payloads.
// Main members: Id, ArchdioceseId, ParishId, AccountId, ScopeName, Role, Allows and related workflow state.

using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.DTOs.Organizations;

public class StaffAppointmentDto
{

    public string Id { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string? ParishId { get; set; }

    public string AccountId { get; set; } = string.Empty;

    public string ScopeName { get; set; } = string.Empty;

    public StaffAppointmentRole Role { get; set; }

    public string[] Allows { get; set; } = Array.Empty<string>();

    public string[] Denies { get; set; } = Array.Empty<string>();

    public string Status { get; set; } = string.Empty;

    public bool Effective { get; set; }

    public bool Head { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public DateTimeOffset AcceptBy { get; set; }

    public DateTimeOffset? ReviewDueAt { get; set; }

    public bool ReviewOverdue { get; set; }

    public string InvitedBy { get; set; } = string.Empty;

    public DateTimeOffset InvitedAt { get; set; }

    public DateTimeOffset? RespondedAt { get; set; }

    public DateTimeOffset? LastReviewedAt { get; set; }

    public DateTimeOffset? HeadStartsAt { get; set; }

    public DateTimeOffset? HeadEndsAt { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string? LastActionReason { get; set; }

    public string? EvidenceReference { get; set; }
}
