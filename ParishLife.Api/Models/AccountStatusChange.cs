// Purpose: one recorded platform-operator suspension or reinstatement of a sign-in account, kept as immutable history in the account's partition.
// Main members: Id, AccountId, Action (Suspended or Reinstated), Reason, By and At.

namespace ParishLife.Api.Models;

public class AccountStatusChange
{
    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
