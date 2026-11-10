// Purpose: previews a closure: records that stay under policy, optional data that would be removed, and access that would end.
// Main members: PersonId, Kept, Removed and Ends.

namespace ParishLife.Api.DTOs.People;

public class DataClosurePreviewDto
{
    public string PersonId { get; set; } = string.Empty;

    public Dictionary<string, int> Kept { get; set; } = new();

    public string[] Removed { get; set; } = Array.Empty<string>();

    public string[] Ends { get; set; } = Array.Empty<string>();
}
