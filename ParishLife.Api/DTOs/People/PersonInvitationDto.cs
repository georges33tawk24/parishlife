// Purpose: shows a person invitation's state to the office or to the account that used it.
// Main members: Id, PersonId, Status, Delivery, CreatedAt, ExpiresAt, UsedByAccountId, UsedAt and ReviewReason.

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
}
