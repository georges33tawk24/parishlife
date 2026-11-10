// Purpose: one language's plain text for a platform homepage block.
// Main members: Title, Body and LinkLabel.

namespace ParishLife.Api.Models;

public class HomepageText
{
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? LinkLabel { get; set; } = null;
}
