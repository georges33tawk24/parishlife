// Purpose: the working homepage draft with per-language readiness.
// Main members: Content, Readiness, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.DTOs.Publishing;

public class HomepageDraftDto
{
    public HomepageContentDto Content { get; set; } = new();
    public HomepageReadinessDto[] Readiness { get; set; } = [];
    public string UpdatedBy { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; set; }
}
