// Purpose: shows one parish status change to the bishop's office.
// Main members: Id, Action, From, To, Reason, By, At and the bishop's command-loaded NotificationOutcome.

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.DTOs.Organizations;

public class ParishStatusChangeDto
{
    public string Id { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public ParishStatus From { get; set; }

    public ParishStatus To { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    // Loaded only for the acting bishop's command response or explicit outcome read; history lists omit it.
    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;
}
