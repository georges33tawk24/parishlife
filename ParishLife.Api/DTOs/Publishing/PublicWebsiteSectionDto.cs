// Purpose: one published website section in the visitor's chosen language.
// Main members: Key, Language, Title, Body and PublishedAt.

namespace ParishLife.Api.DTOs.Publishing;

public class PublicWebsiteSectionDto
{
    public string Key { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public DateTimeOffset? PublishedAt { get; set; }
}
