// Purpose: a reviewer's decision that two suggested people are different (suppressing the suggestion) or need more information.
// Main members: Id, ParishId, PersonA, PersonB, Decision, Reason, By and At.

namespace ParishLife.Api.Models;

public class DuplicateDecision
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string PersonA { get; set; } = string.Empty;

    public string PersonB { get; set; } = string.Empty;

    public string Decision { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
