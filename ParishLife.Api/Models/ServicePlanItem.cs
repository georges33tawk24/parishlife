// Purpose: represents one running-order item of a service plan or template.
// Main members: Key, Title, Minutes, FixedStart, ResponsibleRole, Required, AssignedAccountId, Instructions, InstructionAudience and MusicVersionId.

namespace ParishLife.Api.Models;

public class ServicePlanItem
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public int Minutes { get; set; }

    // An explicit start constraint; other items follow the previous item.
    public DateTimeOffset? FixedStart { get; set; } = null;

    public string? ResponsibleRole { get; set; } = null;

    // A required role must be assigned before review and approval.
    public bool Required { get; set; }

    public string? AssignedAccountId { get; set; } = null;

    public string? Instructions { get; set; } = null;

    // Clergy, Team or Everyone; outputs include instructions only for their audience.
    public string InstructionAudience { get; set; } = "Clergy";

    // Pins one music version so later music edits never change this plan.
    public string? MusicVersionId { get; set; } = null;
}
