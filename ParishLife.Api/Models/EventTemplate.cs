// Purpose: stores a parish's reusable shape for manual calendar drafts (name, kind, audience, usual start and length, description).
// Main members: Id, ParishId, Name, NameAr, Kind, Visibility, StartTime, DurationMinutes, Description, DescriptionAr, Status and audit facts.
// A template only prefills a new draft; it never creates, changes or publishes an event by itself.

namespace ParishLife.Api.Models;

public class EventTemplate
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // Used as the new event's title.
    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    // One of the manual draft kinds: ParishActivity, Appointment or ResourceBlock.
    public string Kind { get; set; } = "ParishActivity";

    // Public, Parish or Private; appointments and resource blocks stay private.
    public string Visibility { get; set; } = "Parish";

    // Usual local start time (HH:mm) on the event's own clock, if the parish set one.
    public string? StartTime { get; set; } = null;

    public int DurationMinutes { get; set; } = 60;

    public string? Description { get; set; } = null;

    public string? DescriptionAr { get; set; } = null;

    // Active or Archived; archived templates are kept and can be restored.
    public string Status { get; set; } = "Active";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
