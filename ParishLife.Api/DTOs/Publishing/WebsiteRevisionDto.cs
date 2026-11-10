// Purpose: shows a website revision to editors and reviewers, with which languages are still missing.
// Main members: Id, Version, SectionKey, Texts, MissingLanguages, Status, CreatedBy, CreatedAt, ReviewedBy, ReviewedAt, ReturnReason and PublishedAt.

namespace ParishLife.Api.DTOs.Publishing;

public class WebsiteRevisionDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string SectionKey { get; set; } = string.Empty;

    public Dictionary<string, WebsiteTextDto> Texts { get; set; } = new();

    public string[] MissingLanguages { get; set; } = Array.Empty<string>();

    public string Status { get; set; } = string.Empty;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? ReviewedBy { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    public string? ReturnReason { get; set; }

    public DateTimeOffset? PublishedAt { get; set; }
}
