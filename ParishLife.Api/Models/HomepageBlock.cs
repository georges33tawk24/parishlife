// Purpose: one platform homepage block (hero, announcement, about, join or a story) with per-language text and one optional safe link.
// Main members: Id, Texts (keys en, fr, ar) and LinkUrl.

namespace ParishLife.Api.Models;

public class HomepageBlock
{
    public string Id { get; set; } = string.Empty;
    public Dictionary<string, HomepageText> Texts { get; set; } = new();
    public string? LinkUrl { get; set; } = null;
}
