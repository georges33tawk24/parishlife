// Purpose: the single working draft of the platform homepage; saving it never changes the published page.
// Main members: Content, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.Models;

public class HomepageDraft
{
    public HomepageContent Content { get; set; } = new();
    public string UpdatedBy { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; set; }
}
