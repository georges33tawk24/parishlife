// Purpose: the public homepage projection: published blocks in section order, with no draft, author or operator information.
// Main members: Language, PublishedAt and Blocks.

namespace ParishLife.Api.DTOs.Publishing;

public class PublicHomepageDto
{
    public string Language { get; set; } = string.Empty;
    public DateTimeOffset PublishedAt { get; set; }
    public PublicHomepageBlockDto[] Blocks { get; set; } = [];
}
