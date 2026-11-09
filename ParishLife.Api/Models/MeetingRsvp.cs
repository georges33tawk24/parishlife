// Purpose: stores one person's actual planning reply to one ministry meeting, independently of attendance.
// Main members: Id, MinistryId, MeetingId, PersonId, AccountId, Response and RespondedAt bind the reply to its reviewed identity.

namespace ParishLife.Api.Models;

public class MeetingRsvp
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Response { get; set; } = string.Empty;

    public DateTimeOffset RespondedAt { get; set; }
}
