// Purpose: stores the durable coordination state for a multi-resource reservation attempt.
// Main members: Id, ParishId, ReservationId, ActorId, MinistryId, MeetingId, Fingerprint, Status, Resources, and related workflow details.

namespace ParishLife.Api.Models;

public class ReservationWork
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ReservationId { get; set; } = string.Empty;

    public string ActorId { get; set; } = string.Empty;

    public string? MinistryId { get; set; }

    public string? MeetingId { get; set; }

    public string? ActingAppointmentId { get; set; }

    public string? ActorSecurityStamp { get; set; }

    public string Fingerprint { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public AllocationSpec[] Resources { get; set; } = Array.Empty<AllocationSpec>();

    public string? LeaseOwner { get; set; } = null;

    public DateTimeOffset? LeaseUntil { get; set; } = null;

    public string? ErrorCode { get; set; } = null;
}
