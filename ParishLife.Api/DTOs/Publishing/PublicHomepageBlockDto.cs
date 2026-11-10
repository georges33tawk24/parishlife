// Purpose: one published homepage block in the visitor's language; Language says which language was actually served.
// Main members: Section, Id, Language, Title, Body, LinkLabel and LinkUrl.

namespace ParishLife.Api.DTOs.Publishing;

public class PublicHomepageBlockDto
{
    public string Section { get; set; } = string.Empty;
    public string Id { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? LinkLabel { get; set; } = null;
    public string? LinkUrl { get; set; } = null;
}
