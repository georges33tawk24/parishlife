// Purpose: one recorded account suspension or reinstatement as shown to platform operators.
// Main members: Id, AccountId, Action, Reason, By and At.

namespace ParishLife.Api.DTOs.Administration;

public class AccountStatusChangeDto
{
    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
