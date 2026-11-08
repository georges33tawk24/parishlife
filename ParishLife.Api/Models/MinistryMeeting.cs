// Purpose: represents ministry meeting business state and rules.
// Main members: Id, MinistryId, EventId, Agenda, MaterialIds, Status, ExpectedPersonIds, and related workflow details.

namespace ParishLife.Api.Models;

public class MinistryMeeting
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string Agenda { get; set; } = string.Empty;

    public string[] MaterialIds { get; set; } = Array.Empty<string>();

    public string Status { get; set; } = string.Empty;

    public string[] ExpectedPersonIds { get; set; } = Array.Empty<string>();

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset? RsvpDeadline { get; set; } = null;
}
