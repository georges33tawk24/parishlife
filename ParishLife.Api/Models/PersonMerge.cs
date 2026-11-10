// Purpose: one reviewed merge of a duplicate person into a surviving person, with both before-snapshots so it can be reviewed and undone.
// Main members: Id, ParishId, SurvivorId, SourceId, SurvivorBefore, SourceBefore, SurvivorAfter, Choices, Reason, By, At, Status,
// UnmergedBy, UnmergedAt and UnmergeReason.

namespace ParishLife.Api.Models;

public class PersonMerge
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string SurvivorId { get; set; } = string.Empty;

    public string SourceId { get; set; } = string.Empty;

    public Person SurvivorBefore { get; set; } = new();

    public Person SourceBefore { get; set; } = new();

    public Person SurvivorAfter { get; set; } = new();

    public Dictionary<string, string> Choices { get; set; } = new();

    public string Reason { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public string Status { get; set; } = "Merged";

    public string? UnmergedBy { get; set; }

    public DateTimeOffset? UnmergedAt { get; set; }

    public string? UnmergeReason { get; set; }
}
