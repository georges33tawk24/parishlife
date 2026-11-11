// Purpose: shows a staged email change without its code.
// Main members: ChangeId, NewEmail, Status, Delivery, ExpiresAt.

namespace ParishLife.Api.DTOs.Accounts;

public class EmailChangeDto
{
    public string ChangeId { get; set; } = string.Empty;

    public string NewEmail { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Delivery { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }
}
