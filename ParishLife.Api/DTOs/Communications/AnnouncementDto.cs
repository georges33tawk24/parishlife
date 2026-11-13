// Purpose: returns an announcement; audience readers never see authoring identities (AuthorAccountId and PublishedBy are staff-only).
// Main members: Id, Visibility, MinistryId, Title, Body, TitleAr, BodyAr, Category, Language, Priority, Pinned, ExpiresAt, Status, PublishedAt,
// PublishedBy and AuthorAccountId.

namespace ParishLife.Api.DTOs.Communications;

public class AnnouncementDto
{
    public string Id { get; set; } = string.Empty;

    public string Visibility { get; set; } = string.Empty;

    public string? MinistryId { get; set; } = null;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public string? BodyAr { get; set; } = null;

    public string? Category { get; set; } = null;

    public string Language { get; set; } = string.Empty;

    public string Priority { get; set; } = "Normal";

    public bool Pinned { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset? PublishedAt { get; set; } = null;

    public string? PublishedBy { get; set; } = null;

    public string? AuthorAccountId { get; set; } = null;
}
