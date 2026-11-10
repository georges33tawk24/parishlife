// Purpose: previews a merge: differing fields that need a choice and records that keep pointing at the merged-away person.
// Main members: Conflicts, Dependents, SourceLinked, SurvivorLinked and NeedsPriest.

namespace ParishLife.Api.DTOs.People;

public class MergePreviewDto
{
    public string[] Conflicts { get; set; } = Array.Empty<string>();

    public Dictionary<string, int> Dependents { get; set; } = new();

    public bool SourceLinked { get; set; }

    public bool SurvivorLinked { get; set; }

    public bool NeedsPriest { get; set; }
}
