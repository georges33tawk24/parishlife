// Purpose: one language version of a public website section.
// Main members: Title and Body.

namespace ParishLife.Api.Models;

public class WebsiteText
{
    public string Title { get; set; } = string.Empty;

    // Plain text; the frontend renders it escaped.
    public string Body { get; set; } = string.Empty;
}
