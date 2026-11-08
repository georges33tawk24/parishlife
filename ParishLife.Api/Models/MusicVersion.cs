// Purpose: represents music version business state and rules.
// Main members: Id, ParishId, Title, Language, Content, RightsStatement, DownloadAllowed, and related workflow details.

namespace ParishLife.Api.Models;

public class MusicVersion
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public string RightsStatement { get; set; } = string.Empty;

    public bool DownloadAllowed { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? SupersedesId { get; set; } = null;
}
