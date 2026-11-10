// Purpose: shows a person invitation's state to the office or to the account that used it.
// Main members: Id, PersonId, Status, Delivery, dates, UsedByAccountId, ReviewReason and office-loaded NotificationOutcome.

using ParishLife.Api.DTOs.Communications;

namespace ParishLife.Api.DTOs.People;

public class PersonInvitationDto
{
    public string Id { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Delivery { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public string? UsedByAccountId { get; set; }

    public DateTimeOffset? UsedAt { get; set; }

    public string? ReviewReason { get; set; }

    // Loaded only for authorized office commands; token claim/preview responses do not disclose notice status.
    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;
}
