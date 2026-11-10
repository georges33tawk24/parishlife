// Purpose: represents one completed step on a sacramental case timeline, with the actual actor, any recorded priest instruction and time.
// Main members: Action, FromStatus, ToStatus, ActorAccountId, InstructingPriestAccountId, InstructionBasis, InstructionGivenAt, At and Note.

namespace ParishLife.Api.Models;

public class SacramentStep
{
    public string Action { get; set; } = string.Empty;

    public string FromStatus { get; set; } = string.Empty;

    public string ToStatus { get; set; } = string.Empty;

    public string ActorAccountId { get; set; } = string.Empty;

    // Set when a secretary records a genuine prior priest instruction.
    public string? InstructingPriestAccountId { get; set; } = null;

    public string? InstructionBasis { get; set; } = null;

    public DateTimeOffset? InstructionGivenAt { get; set; } = null;

    public DateTimeOffset At { get; set; }

    public string? Note { get; set; } = null;
}
