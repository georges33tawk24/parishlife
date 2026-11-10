// Purpose: shows a recorded merge and whether it was undone.
// Main members: Id, Version, SurvivorId, SourceId, Choices, Reason, By, At, Status, UnmergedAt and UnmergeReason.

namespace ParishLife.Api.DTOs.People;

public class PersonMergeDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string SurvivorId { get; set; } = string.Empty;

    public string SourceId { get; set; } = string.Empty;

    public Dictionary<string, string> Choices { get; set; } = new();

    public string Reason { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset? UnmergedAt { get; set; }

    public string? UnmergeReason { get; set; }
}
