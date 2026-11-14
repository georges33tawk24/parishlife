// Purpose: records a priest's explicit end of a membership interval that no departure application covered (a roster removal).
// Main members: Id, MinistryId, PersonId, PeriodId, RemovedBy, ActingAppointmentId, RemovedAt and the data-protected reason.

namespace ParishLife.Api.Models;

public class MinistryMembershipRemoval
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string PeriodId { get; set; } = string.Empty;

    public string RemovedBy { get; set; } = string.Empty;

    public string? ActingAppointmentId { get; set; } = null;

    public DateTimeOffset RemovedAt { get; set; }

    // Protected with the ministry application protector; never placed in receipts or audit text.
    public string? ProtectedReason { get; set; } = null;
}
