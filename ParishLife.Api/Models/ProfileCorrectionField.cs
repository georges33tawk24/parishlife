// Purpose: represents one proposed change to an official Person field and its individual decision.
// Main members: Field, OldValue, NewValue, Evidence, Decision and Reason.

namespace ParishLife.Api.Models;

public class ProfileCorrectionField
{
    public string Field { get; set; } = string.Empty;

    public string? OldValue { get; set; } = null;

    public string NewValue { get; set; } = string.Empty;

    public string? Evidence { get; set; } = null;

    // Pending, Approved or Declined.
    public string Decision { get; set; } = "Pending";

    public string? Reason { get; set; } = null;
}
